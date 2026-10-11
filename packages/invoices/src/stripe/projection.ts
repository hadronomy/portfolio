import Decimal from 'decimal.js';
import type Stripe from 'stripe';
import { calculate, formatMoney } from '../calculate';
import { documentLabels } from '../labels';
import type { Currency, Invoice, Line, Party } from '../model';
import type { Minor, StripeInvoice } from './schema';

// An issued invoice, restated in Stripe's terms. The local calculation stays
// the authority: every line goes over as the taxable amount it ended up with
// after its own and the document's discounts, with the tax already worked out
// beside it (`tax_amounts`), so Stripe adds numbers instead of computing them.
// Base, tax, withholding, and disbursements stay separate lines with their own
// meaning, and a Stripe invoice that does not add up to the same totals is
// never finalized.

/**
 * Bumped whenever the same invoice would reach Stripe differently. It is part
 * of every idempotency key, so a changed projection never replays an old one.
 */
export const projectionVersion = 'v1';

/** What a projected invoice must add up to once Stripe has it. */
export interface Expected {
  readonly currency: string;
  /** Sum of the lines: taxable amounts, minus withholding, plus disbursements. */
  readonly subtotal: Minor;
  /**
   * Sum of the amounts tax was charged on. Exempt and zero-rated lines stay
   * out of it on both sides, so the check holds whether or not Stripe lists
   * a zero tax among its totals.
   */
  readonly taxable: Minor;
  readonly tax: Minor;
  readonly total: Minor;
}

/** Everything Stripe needs to hold the invoice, short of the customer. */
export interface Projection {
  readonly draft: Omit<Stripe.InvoiceCreateParams, 'customer'>;
  readonly lines: readonly Stripe.InvoiceAddLinesParams.Line[];
  readonly expected: Expected;
}

/** Converts a two-decimal amount to minor units, refusing anything finer. */
export function toMinor(amount: string): Minor {
  const cents = new Decimal(amount).mul(100);
  if (!cents.isInteger())
    throw new RangeError(`${amount} has more precision than cents.`);
  return cents.toNumber() as Minor;
}

/**
 * The smallest charge Stripe accepts in each currency, in minor units.
 * https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts
 */
export const minimumCharge: Record<Currency, Minor> = {
  EUR: 50 as Minor,
  USD: 50 as Minor,
  GBP: 30 as Minor,
};

/** The decimal string for an amount in minor units: 92000 → "920.00". */
export const fromMinor = (amount: number) =>
  new Decimal(amount).div(100).toFixed(2);

// IGIC is the only tax the invoice model charges: the issuer is a Canary
// Islands business, so every rate belongs to the Canarias jurisdiction.
const jurisdiction = {
  country: 'ES',
  state: 'CN',
  jurisdiction: 'Canarias',
  jurisdiction_level: 'state',
  tax_type: 'vat',
} as const;

const taxability: Record<
  Line['tax']['treatment'],
  Stripe.InvoiceAddLinesParams.Line.TaxAmount.TaxabilityReason
> = {
  taxable: 'standard_rated',
  exempt: 'product_exempt',
  'outside-scope': 'not_subject_to_tax',
  'reverse-charge': 'reverse_charge',
};

function taxAmount(
  line: Line,
  taxable: string,
  tax: string,
  invoice: Invoice,
): Stripe.InvoiceAddLinesParams.Line.TaxAmount {
  const { treatment, rate, reason } = line.tax;
  const charged = treatment === 'taxable';
  return {
    amount: toMinor(tax),
    taxable_amount: toMinor(taxable),
    taxability_reason:
      charged && new Decimal(rate).isZero()
        ? 'zero_rated'
        : taxability[treatment],
    tax_rate_data: {
      ...jurisdiction,
      display_name: charged
        ? 'IGIC'
        : `IGIC · ${documentLabels[invoice.data.language][treatment]}`,
      percentage: charged ? Number(rate) : 0,
      inclusive: false,
      ...(reason ? { description: reason.slice(0, 500) } : {}),
    },
  };
}

function describe(line: Line, invoice: Invoice) {
  const { language, currency } = invoice.data;
  const text = line.description.trim() || line.kind;
  if (new Decimal(line.quantity).eq(1)) return text;
  const price = formatMoney(line.unitPrice, language, currency);
  return `${text} (${line.quantity} ${line.unit} × ${price})`;
}

/**
 * Restates an issued invoice for Stripe. `now` only matters for an overdue
 * invoice: Stripe will not finalize an invoice that is due in the past, so
 * its due date moves to a day from now. The PDF keeps the real one.
 */
export function project(invoice: Invoice, now = new Date()): Projection {
  const { data } = invoice;
  const totals = calculate(data);
  const lines: Stripe.InvoiceAddLinesParams.Line[] = [];
  data.lines.forEach((line, index) => {
    const amounts = totals.lines[index];
    if (line.kind === 'note' || !amounts) return;
    lines.push({
      description: describe(line, invoice),
      amount: toMinor(amounts.net),
      // Every discount is already inside the amount.
      discountable: false,
      metadata: { line: line.id, kind: line.kind },
      // A disbursement is the customer's own expense, paid on their behalf:
      // it carries no IGIC at all, not even an exempt one.
      ...(line.kind === 'disbursement'
        ? {}
        : {
            tax_amounts: [taxAmount(line, amounts.net, amounts.tax, invoice)],
          }),
    });
  });
  const withholding = toMinor(totals.withholding);
  if (withholding > 0)
    lines.push({
      description: `${documentLabels[data.language].withholding} ${data.withholdingRate}%`,
      amount: -withholding,
      discountable: false,
      metadata: { kind: 'withholding' },
    });

  const [year, month, day] = data.dueDate.split('-').map(Number);
  const due = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 23, 59, 59);
  const tomorrow = now.getTime() + 86_400_000;
  return {
    draft: {
      currency: data.currency.toLowerCase(),
      collection_method: 'send_invoice',
      // The application sends, reminds, and collects; Stripe only holds the
      // invoice and takes the payment.
      auto_advance: false,
      automatic_tax: { enabled: false },
      // Only the lines added below belong here, never stray pending items.
      pending_invoice_items_behavior: 'exclude',
      due_date: Math.floor(Math.max(due, tomorrow) / 1000),
      ...(invoice.number ? { number: invoice.number } : {}),
      ...(data.title.trim() ? { description: data.title.trim() } : {}),
      metadata: { invoice: invoice.id, projection: projectionVersion },
    },
    lines,
    expected: {
      currency: data.currency.toLowerCase(),
      subtotal: toMinor(
        new Decimal(totals.net)
          .minus(totals.withholding)
          .plus(totals.disbursements)
          .toFixed(2),
      ),
      taxable: toMinor(
        totals.lines
          .filter((line) => !new Decimal(line.tax).isZero())
          .reduce((sum, line) => sum.plus(line.net), new Decimal(0))
          .toFixed(2),
      ),
      tax: toMinor(totals.tax),
      total: toMinor(totals.total),
    },
  };
}

/** The Stripe customer for a party, as printed on the invoice. */
export function customerDetails(
  party: Party,
  language: Invoice['data']['language'],
  key: string,
): Stripe.CustomerCreateParams {
  const { address } = party;
  const [line1 = '', ...rest] = address.lines.split('\n');
  const line2 = [...rest, address.dependentLocality].filter(Boolean).join(', ');
  return {
    name: party.name,
    ...(party.email.trim() ? { email: party.email.trim() } : {}),
    address: {
      line1,
      line2,
      city: address.locality,
      state: address.region,
      postal_code: address.postalCode,
      country: address.country,
    },
    preferred_locales: [language],
    metadata: { customer: key },
  };
}

/** One way Stripe's invoice disagrees with the local one. */
export interface Difference {
  readonly field: keyof Expected;
  readonly expected: string | number;
  readonly actual: string | number;
}

/**
 * Where a Stripe draft disagrees with what the projection expects. An empty
 * list is the only state in which the draft may be finalized.
 */
export function differences(
  expected: Expected,
  invoice: StripeInvoice,
): readonly Difference[] {
  const taxes = invoice.taxes ?? [];
  const actual: Record<keyof Expected, string | number> = {
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    taxable: taxes.reduce(
      (sum, tax) => sum + (tax.amount ? (tax.taxableAmount ?? 0) : 0),
      0,
    ),
    tax: taxes.reduce((sum, tax) => sum + tax.amount, 0),
    total: invoice.total,
  };
  return (Object.keys(expected) as (keyof Expected)[]).flatMap((field) =>
    expected[field] === actual[field]
      ? []
      : [{ field, expected: expected[field], actual: actual[field] }],
  );
}

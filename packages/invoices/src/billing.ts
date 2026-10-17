import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import Decimal from 'decimal.js';
import { calculate, formatMoney } from '#calculate';
import {
  type Currency,
  type InvoiceData,
  type Language,
  type Line,
  RecordId,
} from '#model';
import {
  type Due,
  type Laid,
  lay,
  type PaymentPlan,
  type Portion,
  type Span,
  type Terms,
} from '#plan';

// How an accepted quote is billed. The customer accepts it with one of
// its payment plans, and every payment of that plan gets an invoice of its
// own: Spanish invoicing rules ask for an invoice for each payment received
// before the work is done (Real Decreto 1619/2012, art. 2.1, which the
// Canary Islands apply to IGIC). Each invoice carries its share of every
// quoted line, so tax treatment, withholding and disbursements stay exactly
// as quoted, and the last one takes what is left of each line, so the
// invoices add up to the quote to the cent.
//
// A quote's plan reads from the day it is accepted: "on issue" means on
// acceptance, and "the due date" is the quote's planned delivery.

/** A quote's terms for its plan, once accepted on `acceptedOn`. */
export function acceptanceTerms(data: InvoiceData, acceptedOn: string): Terms {
  return {
    total: calculate(data).total,
    currency: data.currency,
    issueDate: acceptedOn,
    dueDate: data.dueDate < acceptedOn ? acceptedOn : data.dueDate,
  };
}

/** The payments a quote is billed in, under `plan`, accepted on `acceptedOn`. */
export function bills(
  data: InvoiceData,
  plan: PaymentPlan,
  acceptedOn: string,
): readonly Laid[] {
  return lay(plan, acceptanceTerms(data, acceptedOn));
}

const money = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2).toFixed(2);

/** A line's own amount: quantity times price, less its discount. */
function lineAmount(line: Line): Decimal {
  const gross = new Decimal(line.quantity).mul(line.unitPrice);
  const off =
    line.discount.kind === 'percent'
      ? gross.mul(line.discount.value).div(100)
      : new Decimal(line.discount.value);
  return gross.minus(off);
}

const percent = (value: Decimal, language: Language) =>
  translate(language)(m.percent, {
    value: value.toDecimalPlaces(2).toNumber(),
  });

/**
 * The invoice for payment `index` of the quote's bills. `number` is the
 * quote's, for the reference; `today` is the invoice's issue date, and the
 * payment's own date its due date when that comes later.
 */
export function billData(
  quote: InvoiceData,
  number: string,
  payments: readonly Laid[],
  index: number,
  today: string,
): InvoiceData {
  const payment = payments[index];
  if (!payment) throw new Error(`The quote has no payment ${index + 1}.`);
  const total = new Decimal(calculate(quote).total);
  const shareOf = (laid: Laid) =>
    total.isZero() ? new Decimal(0) : new Decimal(laid.amount).div(total);
  const last = index === payments.length - 1;
  const share = shareOf(payment);
  const t = translate(quote.language);
  const charged = quote.lines.filter((line) => line.kind !== 'note');
  const lines = charged.map((line): Line => {
    const whole = lineAmount(line);
    // The last payment takes what the earlier ones left of each line, so
    // rounding never loses or invents a cent.
    const amount = last
      ? whole.minus(
          payments
            .slice(0, index)
            .reduce(
              (sum, earlier) => sum.plus(money(whole.mul(shareOf(earlier)))),
              new Decimal(0),
            ),
        )
      : new Decimal(money(whole.mul(share)));
    return {
      ...line,
      id: RecordId.make(crypto.randomUUID()),
      description: `${line.description} · ${percent(share.mul(100), quote.language)}`,
      quantity: '1',
      unit: 'unit',
      unitPrice: money(amount),
      discount: { kind: 'percent', value: '0' },
    };
  });
  const discount =
    quote.discount.kind === 'percent'
      ? quote.discount
      : {
          kind: 'amount' as const,
          value: money(new Decimal(quote.discount.value).mul(share)),
        };
  return {
    ...quote,
    kind: 'invoice',
    quote: null,
    correction: null,
    title: [
      quote.title,
      t(m.bill_payment_of, { index: index + 1, count: payments.length }),
    ]
      .filter(Boolean)
      .join(' · '),
    reference: t(m.bill_reference, { number }),
    issueDate: today,
    supplyDate: today,
    dueDate: payment.date < today ? today : payment.date,
    lines,
    discount,
  };
}

/**
 * A quote's plan as one sentence, before anyone knows when it will be
 * accepted: "30% on acceptance and the rest on delivery".
 */
export function planTerms(
  plan: PaymentPlan,
  language: Language,
  currency: Currency,
): string {
  const t = translate(language);
  const span = (count: number, unit: Span['unit']) =>
    t(m.span, { count, unit });
  const due = (rule: Due, first: boolean) => {
    switch (rule._tag) {
      case 'OnIssue':
        return t(m.terms_on_acceptance);
      case 'InvoiceDue':
        return t(m.terms_on_delivery);
      case 'OnDate':
        return t(m.terms_on_day, { date: rule.date });
      case 'After':
        if (rule.count === 0) return t(m.terms_on_acceptance);
        return rule.from === 'issue' || first
          ? t(m.terms_after_acceptance, { span: span(rule.count, rule.unit) })
          : t(m.terms_later, { span: span(rule.count, rule.unit) });
    }
  };
  const portion = (value: Portion) =>
    value._tag === 'Rest'
      ? t(m.terms_rest)
      : value._tag === 'Percent'
        ? percent(new Decimal(value.value), language)
        : formatMoney(value.value, language, currency);
  const [only] = plan.parts;
  if (
    plan.parts.length === 1 &&
    only?._tag === 'Once' &&
    only.portion._tag === 'Rest'
  )
    return t(m.terms_whole, { due: due(only.due, true) });
  const pieces = plan.parts.map((part, index) =>
    part._tag === 'Once'
      ? t(m.terms_part, {
          portion: portion(part.portion),
          due: due(part.due, index === 0),
        })
      : t(m.terms_series, {
          portion: portion(part.portion),
          count: part.count,
          every: t(m.terms_every, part.every),
          first: due(part.first, index === 0),
        }),
  );
  // A plan reads as a list, joined the way its language joins one.
  const sentence = new Intl.ListFormat(language).format(pieces);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

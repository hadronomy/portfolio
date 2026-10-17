import Decimal from 'decimal.js';
import type {
  Adjustment,
  Currency,
  InvoiceData,
  Language,
  Line,
  Payment,
  RecordId,
} from '#model';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const money = (value: Decimal) => value.toDecimalPlaces(2).toFixed(2);
const sum = (values: readonly string[]) =>
  values.reduce((total, value) => total.plus(value), new D(0));
const allowance = (base: Decimal, adjustment: Adjustment) =>
  adjustment.kind === 'percent'
    ? base.mul(adjustment.value).div(100)
    : new D(adjustment.value);
/** Per-line amounts after the document allowance and tax reconciliation. */
export interface CalculatedLine {
  readonly id: RecordId;
  readonly gross: string;
  readonly discount: string;
  readonly documentDiscount: string;
  readonly net: string;
  readonly tax: string;
  readonly total: string;
}
/** Tax base and charged tax for one treatment/rate/reason combination. */
export interface TaxGroup {
  readonly treatment: Line['tax']['treatment'];
  readonly rate: string;
  readonly reason: string;
  readonly base: string;
  readonly tax: string;
}
/** Full invoice totals. Every amount is a decimal string rounded to cents. */
export interface Totals {
  readonly lines: readonly CalculatedLine[];
  readonly groups: readonly TaxGroup[];
  readonly subtotal: string;
  readonly discount: string;
  readonly net: string;
  readonly tax: string;
  readonly withholding: string;
  readonly disbursements: string;
  readonly total: string;
}
/** Rounds line bases to cents, apportions the document allowance, then rounds tax once per tax group. */
export function calculate(data: InvoiceData): Totals {
  const preliminary = data.lines.map((line) => {
    const gross =
      line.kind === 'note'
        ? new D(0)
        : new D(line.quantity).mul(line.unitPrice);
    const discount = allowance(gross, line.discount);
    return {
      line,
      gross: money(gross),
      discount: money(discount),
      net: money(gross.minus(discount)),
    };
  });
  const eligible = preliminary.filter(
    ({ line }) => line.kind !== 'note' && line.kind !== 'disbursement',
  );
  const base = sum(eligible.map(({ net }) => net));
  const totalAllowance = base.isZero()
    ? new D(0)
    : allowance(base, data.discount).toDecimalPlaces(2);
  // The last eligible line absorbs the cent remainder so the allowance reconciles exactly.
  let allocated = new D(0);
  const last = eligible.at(-1)?.line.id;
  const lines = preliminary.map(({ line, gross, discount, net }) => {
    const share =
      line.kind === 'note' || line.kind === 'disbursement' || base.isZero()
        ? new D(0)
        : line.id === last
          ? totalAllowance.minus(allocated)
          : totalAllowance.mul(net).div(base).toDecimalPlaces(2);
    allocated = allocated.plus(share);
    const taxable = new D(net).minus(share);
    return {
      id: line.id,
      gross,
      discount,
      documentDiscount: money(share),
      net: money(taxable),
      tax: '0.00',
      total: money(taxable),
    };
  });
  const groups: TaxGroup[] = [];
  data.lines.forEach((line, index) => {
    if (line.kind === 'note' || line.kind === 'disbursement') return;
    const existing = groups.findIndex(
      (group) =>
        group.treatment === line.tax.treatment &&
        group.rate === new D(line.tax.rate).toString() &&
        group.reason === line.tax.reason,
    );
    const found = existing < 0 ? undefined : groups[existing];
    const group =
      found ??
      ({
        ...line.tax,
        rate: new D(line.tax.rate).toString(),
        base: '0.00',
        tax: '0.00',
      } satisfies TaxGroup);
    const current = lines[index];
    if (current === undefined) return;
    const nextBase = new D(group.base).plus(current.net);
    const next = {
      ...group,
      base: money(nextBase),
      tax:
        group.treatment === 'taxable'
          ? money(nextBase.mul(group.rate).div(100))
          : '0.00',
    };
    if (existing < 0) groups.push(next);
    else groups.splice(existing, 1, next);
  });
  groups.forEach((group) => {
    const members = data.lines.flatMap((line, index) =>
      line.kind !== 'note' &&
      line.kind !== 'disbursement' &&
      line.tax.treatment === group.treatment &&
      new D(line.tax.rate).eq(group.rate) &&
      line.tax.reason === group.reason
        ? [index]
        : [],
    );
    let allocatedTax = new D(0);
    members.forEach((index, position) => {
      const current = lines[index];
      if (current === undefined) return;
      const value =
        group.treatment !== 'taxable'
          ? new D(0)
          : position === members.length - 1
            ? new D(group.tax).minus(allocatedTax)
            : new D(current.net).mul(group.rate).div(100).toDecimalPlaces(2);
      allocatedTax = allocatedTax.plus(value);
      lines[index] = {
        ...current,
        tax: money(value),
        total: money(new D(current.net).plus(value)),
      };
    });
  });
  const net = sum(groups.map((group) => group.base));
  const tax = sum(groups.map((group) => group.tax));
  const disbursements = sum(
    preliminary
      .filter(({ line }) => line.kind === 'disbursement')
      .map(({ net }) => net),
  );
  const withholdingBase = sum(
    data.lines.flatMap((line, index) => {
      const current = lines[index];
      if (
        !line.withholding ||
        line.kind === 'note' ||
        line.kind === 'disbursement' ||
        current === undefined
      )
        return [];
      return [current.net];
    }),
  );
  const withholding = withholdingBase
    .mul(data.withholdingRate)
    .div(100)
    .toDecimalPlaces(2);
  return {
    lines,
    groups,
    subtotal: money(base),
    discount: money(totalAllowance),
    net: money(net),
    tax: money(tax),
    withholding: money(withholding),
    disbursements: money(disbursements),
    total: money(net.plus(tax).minus(withholding).plus(disbursements)),
  };
}
/** Outstanding balance after subtracting active payments from the invoice total. */
export function balance(total: string, payments: readonly Payment[]): string {
  return money(
    new D(total).minus(
      sum(
        payments
          .filter((payment) => !payment.reversedAt)
          .map((payment) => payment.amount),
      ),
    ),
  );
}
/** A decimal amount as the document's language writes money in `currency`. */
export function formatMoney(
  amount: string,
  language: Language,
  currency: Currency = 'EUR',
): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    // Spanish leaves four-digit amounts ungrouped by default, so 2500,00 €
    // would sit beside a written 2.500,00 €. Money always groups.
    useGrouping: 'always',
  }).format(Number(amount));
}

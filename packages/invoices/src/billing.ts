import Decimal from 'decimal.js';
import { calculate, formatMoney } from './calculate';
import { documentLabels } from './labels';
import {
  type Currency,
  type InvoiceData,
  type Language,
  type Line,
  RecordId,
} from './model';
import {
  type Due,
  type Laid,
  lay,
  type PaymentPlan,
  type Portion,
  type Span,
  type Terms,
} from './plan';

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

const words = {
  en: {
    payment: (index: number, of: number) => `Payment ${index} of ${of}`,
    acceptance: 'on acceptance',
    delivery: 'on delivery',
    on: (day: string) => `on ${day}`,
    after: (span: string) => `${span} after acceptance`,
    later: (span: string) => `${span} later`,
    rest: 'the rest',
    whole: 'The full amount',
    series: (portion: string, count: number, every: string, first: string) =>
      `${portion} in ${count} payments ${every}, the first ${first}`,
    joiner: ', then ',
    units: {
      day: ['day', 'days'],
      week: ['week', 'weeks'],
      month: ['month', 'months'],
    },
    every: (span: Span) =>
      span.count === 1
        ? `every ${words.en.units[span.unit][0]}`
        : `every ${span.count} ${words.en.units[span.unit][1]}`,
  },
  es: {
    payment: (index: number, of: number) => `Pago ${index} de ${of}`,
    acceptance: 'al aceptar',
    delivery: 'a la entrega',
    on: (day: string) => `el ${day}`,
    after: (span: string) => `${span} después de aceptar`,
    later: (span: string) => `${span} después`,
    rest: 'el resto',
    whole: 'El importe completo',
    series: (portion: string, count: number, every: string, first: string) =>
      `${portion} en ${count} pagos ${every}, el primero ${first}`,
    joiner: ', luego ',
    units: {
      day: ['día', 'días'],
      week: ['semana', 'semanas'],
      month: ['mes', 'meses'],
    },
    every: (span: Span) =>
      span.count === 1
        ? `cada ${words.es.units[span.unit][0]}`
        : `cada ${span.count} ${words.es.units[span.unit][1]}`,
  },
} as const;

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
  `${value
    .toDecimalPlaces(2)
    .toString()
    .replace('.', language === 'es' ? ',' : '.')} %`;

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
  const t = documentLabels[quote.language];
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
      words[quote.language].payment(index + 1, payments.length),
    ]
      .filter(Boolean)
      .join(' · '),
    reference: `${t.quote} ${number}`,
    issueDate: today,
    supplyDate: today,
    dueDate: payment.date < today ? today : payment.date,
    lines,
    discount,
  };
}

/**
 * A quote's plan as one sentence, before anyone knows when it will be
 * accepted: "30 % on acceptance, then the rest on delivery".
 */
export function planTerms(
  plan: PaymentPlan,
  language: Language,
  currency: Currency,
  format: (day: string) => string,
): string {
  const w = words[language];
  const span = (count: number, unit: Span['unit']) =>
    `${count} ${w.units[unit][count === 1 ? 0 : 1]}`;
  const due = (rule: Due, first: boolean) => {
    switch (rule._tag) {
      case 'OnIssue':
        return w.acceptance;
      case 'InvoiceDue':
        return w.delivery;
      case 'OnDate':
        return w.on(format(rule.date));
      case 'After':
        if (rule.count === 0) return w.acceptance;
        return rule.from === 'issue' || first
          ? w.after(span(rule.count, rule.unit))
          : w.later(span(rule.count, rule.unit));
    }
  };
  const portion = (value: Portion) =>
    value._tag === 'Rest'
      ? w.rest
      : value._tag === 'Percent'
        ? percent(new Decimal(value.value), language)
        : formatMoney(value.value, language, currency);
  const [only] = plan.parts;
  if (
    plan.parts.length === 1 &&
    only?._tag === 'Once' &&
    only.portion._tag === 'Rest'
  )
    return `${w.whole} ${due(only.due, true)}.`;
  const pieces = plan.parts.map((part, index) =>
    part._tag === 'Once'
      ? `${portion(part.portion)} ${due(part.due, index === 0)}`
      : w.series(
          portion(part.portion),
          part.count,
          w.every(part.every),
          due(part.first, index === 0),
        ),
  );
  const sentence = pieces.join(w.joiner);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

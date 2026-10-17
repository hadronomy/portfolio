import Decimal from 'decimal.js';
import { Schema } from 'effect';
import {
  type Currency,
  DateText,
  DecimalText,
  type Invoice,
  RecordId,
} from '#model';
import { fromMinor, minimumCharge } from '#stripe/projection';

// How a customer may pay an invoice. A plan is rules, not amounts: it holds
// "30% when issued, then the rest in six monthly payments", and `lay` turns
// it into amounts and dates for one invoice. An invoice offers one to four
// plans; the customer picks one, and the first payment under it keeps it.
// The owner's editor, the customer's page and the server's check on each
// payment all read the same evaluation, so they cannot disagree.

const Positive = DecimalText.check(Schema.isPattern(/^\d/));
const Fixed = Schema.TaggedStruct('Amount', { value: Positive });
const Percent = Schema.TaggedStruct('Percent', { value: Positive });
const Rest = Schema.TaggedStruct('Rest', {});

/** A share of the invoice: a fixed amount, or a percentage of the total. */
export const Share = Schema.Union([Fixed, Percent]).pipe(
  Schema.toTaggedUnion('_tag'),
);
export type Share = typeof Share.Type;

/** How much one part of a plan asks for: a share, or what the other parts leave. */
export const Portion = Schema.Union([Fixed, Percent, Rest]).pipe(
  Schema.toTaggedUnion('_tag'),
);
export type Portion = typeof Portion.Type;

export const Unit = Schema.Literals(['day', 'week', 'month']);
export type Unit = typeof Unit.Type;

const Count = (maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));

/** A stretch of calendar time: 30 days, 2 weeks, 1 month. */
export const Span = Schema.Struct({ count: Count(120), unit: Unit });
export interface Span extends Schema.Schema.Type<typeof Span> {}

/** When a payment falls due, relative to the invoice it belongs to. */
export const Due = Schema.TaggedUnion({
  /** The day the invoice is issued. */
  OnIssue: {},
  /**
   * A stretch of time after the issue date, or after the payment before
   * this one. Months keep the day of the month, or the month's last day
   * when it is shorter.
   */
  After: {
    count: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3650 })),
    unit: Unit,
    from: Schema.Literals(['issue', 'previous']),
  },
  OnDate: { date: DateText },
  /** The invoice's own due date. */
  InvoiceDue: {},
});
export type Due = typeof Due.Type;

const Label = Schema.String.check(Schema.isMaxLength(60));

/** One part of a plan: a single payment, or a run of equal ones. */
export const Part = Schema.TaggedUnion({
  Once: { id: RecordId, label: Label, portion: Portion, due: Due },
  /**
   * `portion` split into `count` equal payments, the first on `first` and
   * each next one `every` later. Cents that do not divide go on the last.
   */
  Series: {
    id: RecordId,
    label: Label,
    portion: Portion,
    count: Schema.Int.check(Schema.isBetween({ minimum: 2, maximum: 36 })),
    every: Span,
    first: Due,
  },
});
export type Part = typeof Part.Type;

export const maxParts = 12;
export const maxPayments = 36;
export const maxPlans = 4;

export const PaymentPlan = Schema.Struct({
  id: RecordId,
  /** What the customer reads the plan as when they choose between them. */
  name: Schema.String.check(Schema.isMaxLength(40)),
  /** The payments in order. At most one part takes the rest. */
  parts: Schema.Array(Part).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maxParts),
  ),
  /** Whether the customer may pay more than is due, up to everything. */
  ahead: Schema.Boolean,
  /** The least a customer may pay towards a payment, or null for whole payments only. */
  floor: Schema.NullOr(Share),
});
export interface PaymentPlan extends Schema.Schema.Type<typeof PaymentPlan> {}

/** The plans an invoice offers, the first being the one its page opens on. */
export const Offer = Schema.Array(PaymentPlan).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maxPlans),
);
export type Offer = typeof Offer.Type;

/** What an invoice offers, and the plan the customer last went to pay under. */
export const InvoiceOffer = Schema.Struct({
  plans: Offer,
  /** Binding once a payment lands; until then the customer may still switch. */
  chosen: Schema.NullOr(RecordId),
});
export interface InvoiceOffer extends Schema.Schema.Type<typeof InvoiceOffer> {}

/** A plan the owner keeps for reuse. */
export const PlanTemplate = Schema.Struct({
  plan: PaymentPlan,
  /** Offered on every invoice issued without plans of its own. */
  default: Schema.Boolean,
  /** The least an invoice must total for the default to apply, or null for any total. */
  from: Schema.NullOr(Positive),
});
export interface PlanTemplate extends Schema.Schema.Type<typeof PlanTemplate> {}

export const PlanLibrary = Schema.Array(PlanTemplate).check(
  Schema.isMaxLength(24),
);
export type PlanLibrary = typeof PlanLibrary.Type;

/** One payment of everything, by the invoice's due date: what an invoice without plans offers. */
export const inFull: PaymentPlan = {
  id: RecordId.make('00000000-0000-4000-8000-000000000001'),
  name: '',
  parts: [
    {
      _tag: 'Once',
      id: RecordId.make('00000000-0000-4000-8000-000000000002'),
      label: '',
      portion: { _tag: 'Rest' },
      due: { _tag: 'InvoiceDue' },
    },
  ],
  ahead: true,
  floor: null,
};

export const noOffer: InvoiceOffer = { plans: [inFull], chosen: null };

/** What a plan is evaluated against: the invoice's total and dates. */
export interface Terms {
  readonly total: string;
  readonly currency: Currency;
  readonly issueDate: string;
  readonly dueDate: string;
}

export const termsOf = (invoice: Invoice, total: string): Terms => ({
  total,
  currency: invoice.data.currency,
  issueDate: invoice.data.issueDate,
  dueDate: invoice.data.dueDate,
});

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const money = (value: Decimal.Value) =>
  new D(value).toDecimalPlaces(2).toFixed(2);

const parse = (date: string) => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return { year, month, day };
};
const format = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);

/** `date` moved `count` units later. Months keep the day, or end on a shorter month's last. */
export function shift(date: string, count: number, unit: Unit): string {
  const { year, month, day } = parse(date);
  if (unit !== 'month')
    return format(year, month, day + count * (unit === 'week' ? 7 : 1));
  const last = new Date(Date.UTC(year, month - 1 + count + 1, 0)).getUTCDate();
  return format(year, month + count, Math.min(day, last));
}

/** The calendar date a due rule lands on, `previous` being the date of the payment before. */
export function dueDate(due: Due, terms: Terms, previous: string): string {
  switch (due._tag) {
    case 'OnIssue':
      return terms.issueDate;
    case 'After':
      return shift(
        due.from === 'issue' ? terms.issueDate : previous,
        due.count,
        due.unit,
      );
    case 'OnDate':
      return due.date;
    case 'InvoiceDue':
      return terms.dueDate;
  }
}

/** The amount a share comes to on `total`. */
export const shareOf = (share: Share, total: string) =>
  share._tag === 'Amount'
    ? money(share.value)
    : money(new D(total).mul(share.value).div(100));

/** One payment of a laid-out plan. */
export interface Laid {
  readonly id: string;
  /** The part it comes from. */
  readonly part: RecordId;
  readonly label: string;
  /** Its place in a series, or null for a single payment. */
  readonly step: { readonly index: number; readonly of: number } | null;
  /** Money, two decimals; negative when the plan asks for more than the total. */
  readonly amount: string;
  readonly date: string;
}

/**
 * The plan as payments for these terms, written as they are even when they
 * cannot be collected: the owner has to see what they wrote to fix it.
 */
export function lay(plan: PaymentPlan, terms: Terms): Laid[] {
  const total = new D(terms.total);
  const named = plan.parts.reduce(
    (sum, part) =>
      part.portion._tag === 'Rest'
        ? sum
        : sum.plus(shareOf(part.portion, terms.total)),
    new D(0),
  );
  const rest = plan.parts.find((part) => part.portion._tag === 'Rest');
  const amountOf = (part: Part) =>
    part.portion._tag !== 'Rest'
      ? new D(shareOf(part.portion, terms.total))
      : part === rest
        ? total.minus(named)
        : new D(0);
  const laid: Laid[] = [];
  let previous = terms.issueDate;
  for (const part of plan.parts) {
    const amount = amountOf(part);
    if (part._tag === 'Once') {
      const date = dueDate(part.due, terms, previous);
      laid.push({
        id: part.id,
        part: part.id,
        label: part.label,
        step: null,
        amount: money(amount),
        date,
      });
      previous = date;
      continue;
    }
    const cents = amount.mul(100).toDecimalPlaces(0);
    const each = cents.div(part.count).floor();
    const first = dueDate(part.first, terms, previous);
    for (let index = 0; index < part.count; index++) {
      const last = index === part.count - 1;
      const date = shift(first, part.every.count * index, part.every.unit);
      laid.push({
        id: `${part.id}:${index}`,
        part: part.id,
        label: part.label,
        step: { index, of: part.count },
        amount: money(
          (last ? cents.minus(each.mul(part.count - 1)) : each).div(100),
        ),
        date,
      });
      previous = date;
    }
  }
  return laid;
}

/** Something about a plan that stops it from being collected as written. */
export type Problem =
  /** The parts before the rest already cover the total. */
  | { readonly _tag: 'Overrun'; readonly part: RecordId }
  /** No part takes the rest, and the shares do not add up to the total. */
  | { readonly _tag: 'Unbalanced'; readonly difference: string }
  | { readonly _tag: 'TwoRests' }
  /** A payment is under what Stripe can charge. */
  | { readonly _tag: 'TooSmall'; readonly part: RecordId }
  /** A payment falls before the one ahead of it. */
  | { readonly _tag: 'OutOfOrder'; readonly part: RecordId }
  | { readonly _tag: 'TooMany' }
  /** The least part payment is more than the whole invoice. */
  | { readonly _tag: 'FloorTooHigh' };

/**
 * Why a plan cannot be collected on these terms, or nothing. Every payment
 * must reach what Stripe can charge, the parts must add up to the total,
 * and dates must not run backwards. A plan with problems is never offered.
 */
export function problems(plan: PaymentPlan, terms: Terms): Problem[] {
  const least = new D(fromMinor(minimumCharge[terms.currency]));
  const total = new D(terms.total);
  const found: Problem[] = [];
  const add = (problem: Problem) => {
    const key = JSON.stringify(problem);
    if (!found.some((item) => JSON.stringify(item) === key))
      found.push(problem);
  };
  const rests = plan.parts.filter((part) => part.portion._tag === 'Rest');
  const laid = lay(plan, terms);
  const sum = laid.reduce((acc, payment) => acc.plus(payment.amount), new D(0));
  if (rests.length > 1) add({ _tag: 'TwoRests' });
  const rest = rests[0];
  if (rest) {
    const left = laid
      .filter((payment) => payment.part === rest.id)
      .reduce((acc, payment) => acc.plus(payment.amount), new D(0));
    if (left.lte(0)) add({ _tag: 'Overrun', part: rest.id });
  } else if (!sum.eq(total))
    add({ _tag: 'Unbalanced', difference: money(total.minus(sum)) });
  if (laid.length > maxPayments) add({ _tag: 'TooMany' });
  let previous = '';
  for (const payment of laid) {
    const amount = new D(payment.amount);
    const overrun = rest && payment.part === rest.id && amount.lte(0);
    if (amount.lt(least) && !overrun)
      add({ _tag: 'TooSmall', part: payment.part });
    if (previous && payment.date < previous)
      add({ _tag: 'OutOfOrder', part: payment.part });
    previous = payment.date;
  }
  if (plan.floor && new D(shareOf(plan.floor, terms.total)).gt(total))
    add({ _tag: 'FloorTooHigh' });
  return found;
}

/** Where an instalment stands on a given day. */
export const InstalmentState = Schema.Literals([
  'paid',
  'due',
  'late',
  'upcoming',
]);
export type InstalmentState = typeof InstalmentState.Type;

export const Instalment = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  step: Schema.NullOr(Schema.Struct({ index: Schema.Int, of: Schema.Int })),
  amount: DecimalText,
  date: DateText,
  /** How much of it payments already cover. */
  paid: DecimalText,
  state: InstalmentState,
});
export interface Instalment extends Schema.Schema.Type<typeof Instalment> {}

export const Schedule = Schema.Struct({
  /** The plan the schedule comes from: the owner's, or in full when it has problems. */
  plan: PaymentPlan,
  instalments: Schema.Array(Instalment),
  paid: DecimalText,
  remaining: DecimalText,
  /** Everything whose date has come and is not yet paid. */
  dueNow: DecimalText,
});
export interface Schedule extends Schema.Schema.Type<typeof Schedule> {}

/**
 * The plan as amounts and dates for these terms, with `paid` applied to the
 * instalments in order: payments settle the earliest instalment first,
 * whatever the customer meant them for, so the schedule never skips one.
 */
export function schedule(
  plan: PaymentPlan,
  terms: Terms,
  paid: string,
  today: string,
): Schedule {
  const used = problems(plan, terms).length ? inFull : plan;
  let left = new D(paid);
  let dueNow = new D(0);
  const instalments = lay(used, terms).map((part): Instalment => {
    const covered = D.min(left, part.amount);
    left = left.minus(covered);
    const open = new D(part.amount).minus(covered);
    const state: InstalmentState = open.lte(0)
      ? 'paid'
      : part.date < today
        ? 'late'
        : part.date === today
          ? 'due'
          : 'upcoming';
    if (state === 'late' || state === 'due') dueNow = dueNow.plus(open);
    return {
      id: part.id,
      label: part.label,
      step: part.step,
      amount: part.amount,
      date: part.date,
      paid: money(covered),
      state,
    };
  });
  return {
    plan: used,
    instalments,
    paid: money(paid),
    remaining: money(D.max(new D(terms.total).minus(paid), 0)),
    dueNow: money(dueNow),
  };
}

/** A payment the customer may make right now. */
export const Choice = Schema.Struct({
  kind: Schema.Literals(['next', 'due', 'all']),
  amount: DecimalText,
});
export interface Choice extends Schema.Schema.Type<typeof Choice> {}

/** What the customer may pay now: set amounts, and perhaps any amount in a range. */
export const Options = Schema.Struct({
  choices: Schema.Array(Choice),
  /** Any amount from `minimum` to `maximum`, when the plan lets them choose. */
  range: Schema.NullOr(
    Schema.Struct({ minimum: DecimalText, maximum: DecimalText }),
  ),
});
export interface Options extends Schema.Schema.Type<typeof Options> {}

/**
 * The payments a schedule allows now. Every amount is one Stripe can take
 * and leaves a remainder it can take too, so no plan can strand an
 * uncollectible cent. Paying everything is possible when the plan lets the
 * customer pay ahead, and whenever nothing else is.
 */
export function options(current: Schedule, terms: Terms): Options {
  const remaining = new D(current.remaining);
  if (remaining.lte(0)) return { choices: [], range: null };
  const least = new D(fromMinor(minimumCharge[terms.currency]));
  const collectible = (amount: Decimal) =>
    amount.eq(remaining) ||
    (amount.gte(least) && remaining.minus(amount).gte(least));
  const plan = current.plan;
  const open = current.instalments.find((part) => part.state !== 'paid');
  const next = open ? new D(open.amount).minus(open.paid) : remaining;
  const due = new D(current.dueNow);
  const choices: Choice[] = [];
  if (collectible(next)) choices.push({ kind: 'next', amount: money(next) });
  if (due.gt(next) && collectible(due))
    choices.push({ kind: 'due', amount: money(due) });
  const covered = choices.some((choice) => remaining.eq(choice.amount));
  if ((plan.ahead || choices.length === 0) && !covered)
    choices.push({ kind: 'all', amount: money(remaining) });
  if (!plan.floor) return { choices, range: null };
  const floor = D.max(new D(shareOf(plan.floor, terms.total)), least);
  const ceiling = D.min(
    plan.ahead ? remaining : D.max(next, due),
    remaining.minus(least),
  );
  return {
    choices,
    range: floor.lte(ceiling)
      ? { minimum: money(floor), maximum: money(ceiling) }
      : null,
  };
}

/** Whether `amount` is one of the payments `options` allows. */
export function allows(allowed: Options, amount: string): boolean {
  const value = new D(amount);
  if (allowed.choices.some((choice) => value.eq(choice.amount))) return true;
  const range = allowed.range;
  return !!range && value.gte(range.minimum) && value.lte(range.maximum);
}

/** The plans an offer puts in front of the customer: the ones that work, or in full. */
export function offered(offer: Offer, terms: Terms): Offer {
  const working = offer.filter((plan) => problems(plan, terms).length === 0);
  return working.length ? working : [inFull];
}

/**
 * The plan that applies to an invoice: the customer's choice, or the first
 * one offered until they make it.
 */
export const effective = (
  offer: Offer,
  terms: Terms,
  chosen: string | null,
): PaymentPlan => {
  const plans = offered(offer, terms);
  return plans.find((plan) => plan.id === chosen) ?? plans[0] ?? inFull;
};

/** A copy of `plan` with new IDs, so one template can sit in an offer twice. */
export function copyPlan(plan: PaymentPlan): PaymentPlan {
  return {
    ...plan,
    id: RecordId.make(crypto.randomUUID()),
    parts: plan.parts.map((part) => ({
      ...part,
      id: RecordId.make(crypto.randomUUID()),
    })),
  };
}

/** The plans an invoice of `total` starts with: the library's defaults that apply to it. */
export function defaultsFor(library: PlanLibrary, total: string): Offer {
  return library
    .filter(
      (template) =>
        template.default &&
        (template.from === null || new D(total).gte(template.from)),
    )
    .slice(0, maxPlans)
    .map((template) => copyPlan(template.plan));
}

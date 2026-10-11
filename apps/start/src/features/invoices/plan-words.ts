import type { Translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { formatMoney } from '@portfolio/invoices/calculate';
import type { Currency } from '@portfolio/invoices/model';
import type {
  Due,
  PaymentPlan,
  Portion,
  Span,
  Unit,
} from '@portfolio/invoices/plan';
import { createContext } from 'react';

// Plans in words. The owner builds a plan as sentences ("Then the rest in
// 6 payments every month, starting 1 month later"), so the editor needs
// each piece of a sentence on its own; the customer only ever reads a plan
// whole, as one line, in the invoice's language.

/** "1 Oct", or "1 Oct 2027" outside `year`, in the owner's English. */
export function shortDate(date: string, year?: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(year && date.slice(0, 4) !== year ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

const units: Record<Unit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
};

/** "1 month", "30 days". */
export const spanText = (count: number, unit: Unit) =>
  `${count} ${units[unit][count === 1 ? 0 : 1]}`;

/** What a part asks for, as a token reads it: "30%", "€500.00", "the rest". */
export function portionText(portion: Portion, currency: Currency) {
  switch (portion._tag) {
    case 'Percent':
      return `${portion.value}%`;
    case 'Amount':
      return formatMoney(portion.value, 'en', currency);
    case 'Rest':
      return 'the rest';
  }
}

/**
 * When a payment falls due, as the end of a sentence. The first part has
 * no payment before it, so "later" there means after issue; a series reads
 * "starting …", which wants "on the issue date" rather than "when issued".
 */
export function dueText(
  due: Due,
  where: { readonly first: boolean; readonly series: boolean },
  year: string,
  anchors: Anchors = invoiceAnchors,
): string {
  switch (due._tag) {
    case 'OnIssue':
      return where.series ? anchors.onIssueDate : anchors.whenIssued;
    case 'InvoiceDue':
      return anchors.onDue;
    case 'OnDate':
      return `on ${shortDate(due.date, year)}`;
    case 'After': {
      const afterIssue = due.from === 'issue' || where.first;
      if (due.count === 0)
        return afterIssue
          ? dueText({ _tag: 'OnIssue' }, where, year, anchors)
          : 'the same day';
      return `${spanText(due.count, due.unit)} ${afterIssue ? anchors.afterIssue : 'later'}`;
    }
  }
}

/**
 * The two days a plan counts from, in the owner's words. An invoice's plan
 * counts from its issue and its due date; a quote's from the day it is
 * accepted and its planned delivery.
 */
export interface Anchors {
  readonly whenIssued: string;
  readonly onIssueDate: string;
  readonly onDue: string;
  readonly afterIssue: string;
  /** A preset's words, capitalised. */
  readonly presetIssue: string;
  readonly presetDue: string;
  /** What one payment of everything means. */
  readonly inFull: string;
}

export const invoiceAnchors: Anchors = {
  whenIssued: 'when issued',
  onIssueDate: 'on the issue date',
  onDue: 'on the due date',
  afterIssue: 'after issue',
  presetIssue: 'When issued',
  presetDue: 'On the due date',
  inFull: 'One payment, by the due date.',
};

export const quoteAnchors: Anchors = {
  whenIssued: 'on acceptance',
  onIssueDate: 'on acceptance',
  onDue: 'on delivery',
  afterIssue: 'after acceptance',
  presetIssue: 'On acceptance',
  presetDue: 'On delivery',
  inFull: 'One payment, on delivery.',
};

/** The anchors the plan editor in view speaks. */
export const AnchorContext = createContext<Anchors>(invoiceAnchors);

/** "every month", "every 2 weeks". */
export const everyText = (every: Span) =>
  every.count === 1
    ? `every ${units[every.unit][0]}`
    : `every ${spanText(every.count, every.unit)}`;

/** A payment of a plan, in the order the plan lays them out. */
interface Laid {
  readonly amount: string;
  readonly date: string;
}

/** The name a customer reads a plan by: the owner's, or one that says what it is. */
export function planName(
  plan: PaymentPlan,
  payments: readonly Laid[],
  t: Translate,
) {
  if (plan.name) return plan.name;
  if (payments.length > 1)
    return t(m.plan_payments, { count: payments.length });
  return t(plan.floor ? m.plan_flexible : m.plan_whole);
}

/**
 * A plan as one line: "€714.23 now, then 6 × €277.75 monthly from 1 Nov".
 * `payments` are the plan's own, laid out for the invoice; a series reads
 * as its count and the first payment, since only its last cent differs.
 */
export function planLine(
  plan: PaymentPlan,
  payments: readonly Laid[],
  options: {
    readonly t: Translate;
    readonly currency: Currency;
    readonly today: string;
    /** The least part payment, when the plan takes them. */
    readonly floor?: string;
  },
) {
  const { t, currency, today } = options;
  const money = (amount: string) => formatMoney(amount, t.locale, currency);
  // This year's dates leave the year out.
  const date = (value: string) =>
    t(
      value.slice(0, 4) === today.slice(0, 4) ? m.date_short : m.date_document,
      {
        date: value,
      },
    );
  const [only] = payments;
  if (payments.length === 1 && only)
    return plan.floor && options.floor
      ? t(m.plan_any, { floor: money(options.floor), date: date(only.date) })
      : t(m.plan_by, { amount: money(only.amount), date: date(only.date) });
  const pieces: string[] = [];
  let at = 0;
  for (const part of plan.parts) {
    const first = payments[at];
    if (!first) break;
    if (part._tag === 'Once') {
      pieces.push(
        `${money(first.amount)} ${first.date <= today ? t(m.plan_now) : t(m.plan_on, { date: date(first.date) })}`,
      );
      at += 1;
      continue;
    }
    pieces.push(
      `${part.count} × ${money(first.amount)} ${t(m.plan_every, part.every)}${first.date <= today ? '' : t(m.plan_from, { date: date(first.date) })}`,
    );
    at += part.count;
  }
  return new Intl.ListFormat(t.locale).format(pieces);
}

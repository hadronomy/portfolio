import { type Language, RecordId } from '@portfolio/invoices/model';
import type {
  Due,
  Part,
  PaymentPlan,
  Portion,
  Share,
  Span,
} from '@portfolio/invoices/plan';

// The shapes most invoices are paid in, ready to edit. Each makes a whole
// plan with fresh IDs; names are what the customer reads, so they come in
// the invoice's language.

const id = () => RecordId.make(crypto.randomUUID());

export const percent = (value: number): Share => ({
  _tag: 'Percent',
  value: String(value),
});
const rest: Portion = { _tag: 'Rest' };
const onIssue: Due = { _tag: 'OnIssue' };
const after = (
  count: number,
  unit: Span['unit'],
  from: 'issue' | 'previous' = 'previous',
): Due => ({ _tag: 'After', count, unit, from });
const monthly: Span = { count: 1, unit: 'month' };

export const once = (portion: Portion, due: Due, label = ''): Part => ({
  _tag: 'Once',
  id: id(),
  label,
  portion,
  due,
});
export const series = (
  portion: Portion,
  count: number,
  first: Due,
  every: Span = monthly,
  label = '',
): Part => ({
  _tag: 'Series',
  id: id(),
  label,
  portion,
  count,
  every,
  first,
});
export const plan = (
  name: string,
  parts: Part[],
  rules: Partial<Pick<PaymentPlan, 'ahead' | 'floor'>> = {},
): PaymentPlan => ({
  id: id(),
  name,
  parts,
  ahead: true,
  floor: null,
  ...rules,
});

const names = {
  en: {
    full: 'Pay in full',
    deposit: 'Deposit',
    balance: 'Balance',
    depositFirst: 'Deposit, then the balance',
    halves: 'Two halves',
    monthly: 'Monthly',
    depositMonthly: 'Deposit, then monthly',
    kickoff: 'Kick-off',
    midpoint: 'Midpoint',
    delivery: 'Delivery',
    milestones: 'By milestone',
    flexible: 'Pay as you go',
  },
  es: {
    full: 'Pago único',
    deposit: 'Anticipo',
    balance: 'Resto',
    depositFirst: 'Anticipo y resto',
    halves: 'Dos mitades',
    monthly: 'Mensual',
    depositMonthly: 'Anticipo y mensualidades',
    kickoff: 'Inicio',
    midpoint: 'Mitad del proyecto',
    delivery: 'Entrega',
    milestones: 'Por hitos',
    flexible: 'A tu ritmo',
  },
} satisfies Record<Language, Record<string, string>>;

export interface Starter {
  readonly key: string;
  /** What the owner picks it by. */
  readonly title: string;
  readonly make: (language: Language) => PaymentPlan;
}

export const starters: readonly Starter[] = [
  {
    key: 'full',
    title: 'One payment',
    make: (language) =>
      plan(names[language].full, [once(rest, { _tag: 'InvoiceDue' })]),
  },
  {
    key: 'deposit',
    title: 'Deposit and balance',
    make: (language) => {
      const t = names[language];
      return plan(t.depositFirst, [
        once(percent(30), onIssue, t.deposit),
        once(rest, { _tag: 'InvoiceDue' }, t.balance),
      ]);
    },
  },
  {
    key: 'halves',
    title: 'Two halves',
    make: (language) =>
      plan(names[language].halves, [
        once(percent(50), onIssue),
        once(rest, { _tag: 'InvoiceDue' }),
      ]),
  },
  {
    key: 'monthly',
    title: 'Three monthly payments',
    make: (language) =>
      plan(names[language].monthly, [series(rest, 3, onIssue)]),
  },
  {
    key: 'deposit-monthly',
    title: 'Deposit, then monthly',
    make: (language) => {
      const t = names[language];
      return plan(t.depositMonthly, [
        once(percent(25), onIssue, t.deposit),
        series(rest, 6, after(1, 'month')),
      ]);
    },
  },
  {
    key: 'milestones',
    title: 'Milestones',
    make: (language) => {
      const t = names[language];
      return plan(t.milestones, [
        once(percent(30), onIssue, t.kickoff),
        once(percent(40), after(30, 'day', 'issue'), t.midpoint),
        once(rest, after(60, 'day', 'issue'), t.delivery),
      ]);
    },
  },
  {
    key: 'flexible',
    title: 'Any amount',
    make: (language) =>
      plan(names[language].flexible, [once(rest, { _tag: 'InvoiceDue' })], {
        floor: percent(10),
      }),
  },
];

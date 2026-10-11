import {
  lay,
  type PaymentPlan,
  problems,
  type Terms,
} from '@portfolio/invoices/plan';
import { describe, expect, test } from 'vitest';
import { bounds, moveSeam } from './plan-edit';
import { once, percent, plan, series } from './plan-starters';

const terms: Terms = {
  total: '2380.75',
  currency: 'EUR',
  issueDate: '2026-10-10',
  dueDate: '2026-11-09',
};
const later = {
  _tag: 'After',
  count: 1,
  unit: 'month',
  from: 'previous',
} as const;
const monthly: PaymentPlan = plan('Deposit, then monthly', [
  once(percent(25), { _tag: 'OnIssue' }),
  series({ _tag: 'Rest' }, 6, later),
]);
const amounts = (value: PaymentPlan) =>
  lay(value, terms).map((payment) => payment.amount);

describe('moveSeam', () => {
  test('never rounds a share past what its neighbour still needs', () => {
    // 99.9% of the total is 99%: rounding up would leave six payments of nothing.
    const moved = moveSeam(monthly, terms, 0, 237_900);
    expect(moved.parts[0]?.portion).toEqual({ _tag: 'Percent', value: '99' });
    expect(problems(moved, terms)).toEqual([]);
  });

  test('keeps a part at what Stripe can charge', () => {
    const moved = moveSeam(monthly, terms, 0, 0);
    expect(problems(moved, terms)).toEqual([]);
    expect(Number(amounts(moved)[0])).toBeGreaterThanOrEqual(0.5);
  });
});

describe('bounds', () => {
  test('leaves the rest what its payments need', () => {
    const [deposit] = monthly.parts;
    expect(deposit && bounds(monthly, terms, deposit.id)).toEqual({
      least: 50,
      most: 238_075 - 6 * 50,
    });
  });

  test('counts the parts that hold numbers', () => {
    const milestones = plan('Milestones', [
      once(percent(20), { _tag: 'OnIssue' }),
      once(percent(30), { _tag: 'InvoiceDue' }),
      once({ _tag: 'Rest' }, { _tag: 'InvoiceDue' }),
    ]);
    const second = milestones.parts[1];
    expect(second && bounds(milestones, terms, second.id).most).toBe(
      238_075 - 47_615 - 50,
    );
  });
});

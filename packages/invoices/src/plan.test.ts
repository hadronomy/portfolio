import { describe, expect, it } from 'vitest';
import { RecordId } from './model';
import {
  allows,
  type Due,
  defaultsFor,
  effective,
  inFull,
  lay,
  offered,
  options,
  type Part,
  type PaymentPlan,
  type Portion,
  problems,
  schedule,
  shift,
  type Terms,
} from './plan';

const terms: Terms = {
  total: '2380.75',
  currency: 'EUR',
  issueDate: '2026-10-01',
  dueDate: '2026-10-31',
};

const id = () => RecordId.make(crypto.randomUUID());
const once = (portion: Portion, due: Due, label = ''): Part => ({
  _tag: 'Once',
  id: id(),
  label,
  portion,
  due,
});
const percent = (value: string): Portion => ({ _tag: 'Percent', value });
const rest: Portion = { _tag: 'Rest' };
const plan = (
  parts: Part[],
  rules: Partial<Pick<PaymentPlan, 'ahead' | 'floor'>> = {},
): PaymentPlan => ({
  id: id(),
  name: 'Plan',
  parts,
  ahead: true,
  floor: null,
  ...rules,
});

const depositThenRest = plan([
  once(percent('30'), { _tag: 'OnIssue' }, 'Deposit'),
  once(rest, { _tag: 'InvoiceDue' }, 'Balance'),
]);

const monthly = plan([
  once(percent('30'), { _tag: 'OnIssue' }, 'Deposit'),
  {
    _tag: 'Series',
    id: id(),
    label: 'Monthly',
    portion: rest,
    count: 3,
    every: { count: 1, unit: 'month' },
    first: { _tag: 'After', count: 1, unit: 'month', from: 'previous' },
  },
]);

describe('payment plans', () => {
  it('lays a deposit and the rest out as amounts and dates that add up', () => {
    const current = schedule(depositThenRest, terms, '0', '2026-10-01');
    expect(
      current.instalments.map((part) => [
        part.label,
        part.amount,
        part.date,
        part.state,
      ]),
    ).toEqual([
      ['Deposit', '714.23', '2026-10-01', 'due'],
      ['Balance', '1666.52', '2026-10-31', 'upcoming'],
    ]);
    expect(current.dueNow).toBe('714.23');
  });

  it('splits a series into equal payments, the odd cents on the last', () => {
    expect(
      lay(monthly, terms).map((part) => [part.amount, part.date, part.step]),
    ).toEqual([
      ['714.23', '2026-10-01', null],
      ['555.50', '2026-11-01', { index: 0, of: 3 }],
      ['555.50', '2026-12-01', { index: 1, of: 3 }],
      ['555.52', '2027-01-01', { index: 2, of: 3 }],
    ]);
  });

  it('keeps the day of the month, or the last day of a shorter month', () => {
    expect(shift('2027-01-31', 1, 'month')).toBe('2027-02-28');
    expect(shift('2027-01-31', 2, 'month')).toBe('2027-03-31');
    expect(shift('2026-12-15', 2, 'week')).toBe('2026-12-29');
  });

  it('settles the earliest instalment first and marks what is late', () => {
    const current = schedule(depositThenRest, terms, '800', '2026-11-02');
    expect(current.instalments.map((part) => [part.paid, part.state])).toEqual([
      ['714.23', 'paid'],
      ['85.77', 'late'],
    ]);
    expect(current.remaining).toBe('1580.75');
    expect(current.dueNow).toBe('1580.75');
  });

  it('offers the next instalment, and everything when paying ahead is allowed', () => {
    const now = schedule(depositThenRest, terms, '0', '2026-10-01');
    expect(options(now, terms).choices).toEqual([
      { kind: 'next', amount: '714.23' },
      { kind: 'all', amount: '2380.75' },
    ]);
    const strict = { ...depositThenRest, ahead: false };
    expect(
      options(schedule(strict, terms, '0', '2026-10-01'), terms).choices,
    ).toEqual([{ kind: 'next', amount: '714.23' }]);
  });

  it('offers what is due when several instalments have come due', () => {
    const late = schedule(monthly, terms, '0', '2026-11-20');
    expect(options(late, terms).choices).toEqual([
      { kind: 'next', amount: '714.23' },
      { kind: 'due', amount: '1269.73' },
      { kind: 'all', amount: '2380.75' },
    ]);
  });

  it('lets a customer pay any part from the floor, leaving something chargeable', () => {
    const flexible = plan([once(rest, { _tag: 'InvoiceDue' })], {
      floor: { _tag: 'Percent', value: '10' },
    });
    const allowed = options(
      schedule(flexible, terms, '0', '2026-10-01'),
      terms,
    );
    expect(allowed.range).toEqual({ minimum: '238.08', maximum: '2380.25' });
    expect(allows(allowed, '300')).toBe(true);
    expect(allows(allowed, '100')).toBe(false);
    expect(allows(allowed, '2380.75')).toBe(true);
  });

  it('caps a part payment at what is due when the plan keeps to its dates', () => {
    const strict = { ...depositThenRest, ahead: false, floor: percent('5') };
    const allowed = options(
      schedule(strict as PaymentPlan, terms, '0', '2026-10-01'),
      terms,
    );
    expect(allowed.range).toEqual({ minimum: '119.04', maximum: '714.23' });
    expect(allows(allowed, '2380.75')).toBe(false);
  });

  it('takes the rest from the middle and holds a final payment back', () => {
    const retention = plan([
      once(percent('20'), { _tag: 'OnIssue' }),
      once(rest, { _tag: 'InvoiceDue' }),
      once(
        { _tag: 'Amount', value: '200' },
        { _tag: 'After', count: 30, unit: 'day', from: 'previous' },
      ),
    ]);
    expect(problems(retention, terms)).toEqual([]);
    expect(lay(retention, terms).map((part) => part.amount)).toEqual([
      '476.15',
      '1704.60',
      '200.00',
    ]);
  });

  it('says why a plan cannot be collected, and never offers it', () => {
    const overrun = plan([
      once(percent('100'), { _tag: 'OnIssue' }),
      once(rest, { _tag: 'InvoiceDue' }),
    ]);
    expect(problems(overrun, terms)).toEqual([
      { _tag: 'Overrun', part: overrun.parts[1]?.id },
    ]);
    expect(schedule(overrun, terms, '0', '2026-10-01').plan).toEqual(inFull);

    const backwards = plan([
      once(percent('50'), {
        _tag: 'After',
        count: 60,
        unit: 'day',
        from: 'issue',
      }),
      once(rest, { _tag: 'InvoiceDue' }),
    ]);
    expect(problems(backwards, terms)).toEqual([
      { _tag: 'OutOfOrder', part: backwards.parts[1]?.id },
    ]);

    const short = plan([
      once(percent('50'), { _tag: 'OnIssue' }),
      once(percent('40'), { _tag: 'InvoiceDue' }),
    ]);
    expect(problems(short, terms)).toEqual([
      { _tag: 'Unbalanced', difference: '238.07' },
    ]);
    expect(offered([short, depositThenRest], terms)).toEqual([depositThenRest]);
    expect(offered([short], terms)).toEqual([inFull]);
  });

  it('applies the customer’s choice, or the first plan until they make one', () => {
    expect(effective([depositThenRest, monthly], terms, null)).toBe(
      depositThenRest,
    );
    expect(effective([depositThenRest, monthly], terms, monthly.id)).toBe(
      monthly,
    );
  });

  it('starts an invoice on the defaults its total qualifies for', () => {
    const library = [
      { plan: depositThenRest, default: true, from: null },
      { plan: monthly, default: true, from: '5000' },
      { plan: inFull, default: false, from: null },
    ];
    const small = defaultsFor(library, '2380.75');
    expect(small.map((item) => item.name)).toEqual(['Plan']);
    expect(small[0]?.id).not.toBe(depositThenRest.id);
    expect(defaultsFor(library, '6000')).toHaveLength(2);
  });

  it('pays in full in one go', () => {
    const allowed = options(schedule(inFull, terms, '0', '2026-10-01'), terms);
    expect(allowed).toEqual({
      choices: [{ kind: 'next', amount: '2380.75' }],
      range: null,
    });
    expect(allows(allowed, '100')).toBe(false);
  });
});

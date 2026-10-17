import { billData, bills, planTerms } from '@portfolio/invoices/billing';
import { calculate } from '@portfolio/invoices/calculate';
import { quoteSpecimen } from '@portfolio/invoices/fixtures';
import { RecordId } from '@portfolio/invoices/model';
import { inFull, type PaymentPlan } from '@portfolio/invoices/plan';
import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

const id = () => RecordId.make(crypto.randomUUID());
const thirds: PaymentPlan = {
  id: id(),
  name: '',
  ahead: true,
  floor: null,
  parts: [
    {
      _tag: 'Once',
      id: id(),
      label: '',
      portion: { _tag: 'Percent', value: '30' },
      due: { _tag: 'OnIssue' },
    },
    {
      _tag: 'Once',
      id: id(),
      label: '',
      portion: { _tag: 'Percent', value: '33.33' },
      due: { _tag: 'After', count: 3, unit: 'week', from: 'issue' },
    },
    {
      _tag: 'Once',
      id: id(),
      label: '',
      portion: { _tag: 'Rest' },
      due: { _tag: 'InvoiceDue' },
    },
  ],
};

describe('billing a quote', () => {
  const quote = quoteSpecimen('es').data;
  const accepted = '2026-10-11';

  it('lays the plan from the acceptance day to the delivery date', () => {
    const laid = bills({ ...quote, dueDate: '2026-12-01' }, thirds, accepted);
    expect(laid.map((payment) => payment.date)).toEqual([
      '2026-10-11',
      '2026-11-01',
      '2026-12-01',
    ]);
  });

  it('bills every payment so the invoices add up to the quote to the cent', () => {
    const laid = bills(quote, thirds, accepted);
    const invoices = laid.map((_, index) =>
      billData(quote, 'P-2026-0001', laid, index, accepted),
    );
    const sum = (pick: (totals: ReturnType<typeof calculate>) => string) =>
      invoices
        .reduce(
          (total, data) => total.plus(pick(calculate(data))),
          new Decimal(0),
        )
        .toFixed(2);
    const whole = calculate(quote);
    expect(sum((totals) => totals.net)).toBe(whole.net);
    expect(
      new Decimal(sum((totals) => totals.total))
        .minus(whole.total)
        .abs()
        .lte('0.02'),
    ).toBe(true);
    expect(invoices[0]).toMatchObject({
      kind: 'invoice',
      quote: null,
      reference: 'Presupuesto P-2026-0001',
    });
    expect(invoices[0]?.title).toContain('Pago 1 de 3');
    expect(invoices[0]?.lines.every((line) => line.tax.rate === '7')).toBe(
      true,
    );
  });

  it('states a plan in words before anyone knows the dates', () => {
    expect(planTerms(thirds, 'en', 'EUR')).toBe(
      '30% on acceptance, 33.33% 3 weeks after acceptance, and the rest on delivery.',
    );
    expect(planTerms(thirds, 'es', 'EUR')).toBe(
      '30\u00a0% al aceptar, 33,33\u00a0% 3 semanas después de la aceptación y el resto a la entrega.',
    );
    expect(planTerms(inFull, 'es', 'EUR')).toBe(
      'El importe total a la entrega.',
    );
  });
});

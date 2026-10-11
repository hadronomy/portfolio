import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { calculate } from '../calculate';
import { specimen } from '../fixtures';
import { type Invoice, type Line, newLine } from '../model';
import {
  customerDetails,
  differences,
  fromMinor,
  project,
  toMinor,
} from './projection';
import type { Minor, StripeInvoice, StripeInvoiceId } from './schema';

const issued = (
  lines: Line[],
  data: Partial<Invoice['data']> = {},
): Invoice => {
  const base = specimen();
  return {
    ...base,
    status: 'issued',
    number: 'INV-2026-0007',
    issuedAt: '2026-09-09T12:00:00.000Z',
    data: { ...base.data, ...data, lines },
  };
};

const line = (fields: Partial<Line>): Line => ({ ...newLine(), ...fields });

/** Adds up lines the way Stripe does once it has them. */
function asStripe(
  lines: readonly Stripe.InvoiceAddLinesParams.Line[],
  currency = 'eur',
): StripeInvoice {
  const taxes = lines.flatMap((item) =>
    Array.isArray(item.tax_amounts) ? item.tax_amounts : [],
  );
  const subtotal = lines.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const tax = taxes.reduce((sum, item) => sum + item.amount, 0);
  return {
    id: 'in_test' as StripeInvoiceId,
    status: 'draft',
    currency,
    subtotal: subtotal as Minor,
    total: (subtotal + tax) as Minor,
    amountRemaining: (subtotal + tax) as Minor,
    taxes: taxes.map((item) => ({
      amount: item.amount as Minor,
      taxableAmount: item.taxable_amount as Minor,
    })),
    lines: { data: lines.map(() => ({})) },
    metadata: {},
  };
}

describe('Stripe projection', () => {
  it('collects base plus IGIC minus withholding, and nothing else', () => {
    // €1,000 base, 7% IGIC, 15% withholding: €920 to collect.
    const invoice = issued(
      [line({ description: 'Consulting', quantity: '1', unitPrice: '1000' })],
      { withholdingRate: '15', withholdingReason: 'general-professional' },
    );
    const { lines, expected } = project(invoice);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      amount: 100000,
      tax_amounts: [
        {
          amount: 7000,
          taxable_amount: 100000,
          taxability_reason: 'standard_rated',
          tax_rate_data: { display_name: 'IGIC', percentage: 7 },
        },
      ],
    });
    expect(lines[1]).toMatchObject({
      amount: -15000,
      metadata: { kind: 'withholding' },
    });
    expect(lines[1]).not.toHaveProperty('tax_amounts');
    expect(expected).toEqual({
      currency: 'eur',
      subtotal: 85000,
      taxable: 100000,
      tax: 7000,
      total: 92000,
    });
    expect(differences(expected, asStripe(lines))).toEqual([]);
  });

  it('keeps every amount the calculator produced, to the cent', () => {
    const invoice = issued(
      [
        line({ description: 'Design', quantity: '2.5', unitPrice: '333.33' }),
        line({
          description: 'Workshop',
          quantity: '3',
          unitPrice: '99.99',
          discount: { kind: 'percent', value: '12.5' },
          tax: { treatment: 'taxable', rate: '9.5', reason: '' },
        }),
        line({
          description: 'Training',
          quantity: '1',
          unitPrice: '410',
          withholding: false,
          tax: {
            treatment: 'exempt',
            rate: '0',
            reason: 'Art. 50.Uno.9 Ley 4/2012',
          },
        }),
        line({ kind: 'note', description: 'Phase one' }),
        line({
          kind: 'disbursement',
          description: 'Registry fee',
          unitPrice: '61.27',
          withholding: false,
        }),
      ],
      {
        discount: { kind: 'percent', value: '10' },
        withholdingRate: '15',
        withholdingReason: 'general-professional',
      },
    );
    const totals = calculate(invoice.data);
    const { lines, expected } = project(invoice);

    // The note prints on the PDF only; everything else becomes a line.
    expect(lines.map((item) => item.metadata)).toEqual([
      { line: invoice.data.lines[0]?.id, kind: 'service' },
      { line: invoice.data.lines[1]?.id, kind: 'service' },
      { line: invoice.data.lines[2]?.id, kind: 'service' },
      { line: invoice.data.lines[4]?.id, kind: 'disbursement' },
      { kind: 'withholding' },
    ]);
    // Per-line tax is the calculator's, already reconciled to its group.
    expect(
      lines
        .slice(0, 3)
        .map((item) =>
          Array.isArray(item.tax_amounts) ? item.tax_amounts[0]?.amount : null,
        ),
    ).toEqual(totals.lines.slice(0, 3).map((amounts) => toMinor(amounts.tax)));
    expect(lines[2]).toMatchObject({
      tax_amounts: [
        {
          amount: 0,
          taxability_reason: 'product_exempt',
          tax_rate_data: {
            display_name: 'IGIC · Exempt',
            percentage: 0,
            description: 'Art. 50.Uno.9 Ley 4/2012',
          },
        },
      ],
    });
    // A disbursement carries no IGIC, not even an exempt one.
    expect(lines[3]).not.toHaveProperty('tax_amounts');
    expect(fromMinor(expected.total)).toBe(totals.total);
    expect(fromMinor(expected.tax)).toBe(totals.tax);
    expect(differences(expected, asStripe(lines))).toEqual([]);
  });

  it('agrees whether or not Stripe lists a zero tax among its totals', () => {
    const invoice = issued([
      line({ unitPrice: '100' }),
      line({
        unitPrice: '50',
        tax: { treatment: 'exempt', rate: '0', reason: 'Art. 50' },
      }),
    ]);
    const { lines, expected } = project(invoice);
    const listed = asStripe(lines);
    const dropped = {
      ...listed,
      taxes: (listed.taxes ?? []).filter((tax) => tax.amount !== 0),
    };
    expect(differences(expected, listed)).toEqual([]);
    expect(differences(expected, dropped)).toEqual([]);
  });

  it('names each way Stripe disagrees', () => {
    const invoice = issued([line({ unitPrice: '100' })]);
    const { lines, expected } = project(invoice);
    const stripe = asStripe(lines);
    expect(
      differences(expected, {
        ...stripe,
        currency: 'usd',
        total: (stripe.total + 1) as Minor,
      }),
    ).toEqual([
      { field: 'currency', expected: 'eur', actual: 'usd' },
      { field: 'total', expected: 10700, actual: 10701 },
    ]);
  });

  it('describes the draft so Stripe holds and never sends it', () => {
    const invoice = issued([line({ unitPrice: '100' })], {
      dueDate: '2026-10-09',
      title: 'Product design',
    });
    const { draft } = project(invoice, new Date('2026-09-10T00:00:00Z'));
    expect(draft).toEqual({
      currency: 'eur',
      collection_method: 'send_invoice',
      auto_advance: false,
      automatic_tax: { enabled: false },
      pending_invoice_items_behavior: 'exclude',
      due_date: Date.UTC(2026, 9, 9, 23, 59, 59) / 1000,
      number: 'INV-2026-0007',
      description: 'Product design',
      metadata: { invoice: invoice.id, projection: 'v1' },
    });
  });

  it('gives an overdue invoice a day to be paid in', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const { draft } = project(
      issued([line({ unitPrice: '100' })], { dueDate: '2026-10-09' }),
      now,
    );
    expect(draft.due_date).toBe(Math.floor(now.getTime() / 1000) + 86_400);
  });

  it('refuses amounts finer than a cent', () => {
    expect(toMinor('920.00')).toBe(92000);
    expect(toMinor('-150.5')).toBe(-15050);
    expect(() => toMinor('0.001')).toThrow(RangeError);
  });

  it('addresses the customer as the invoice does', () => {
    const invoice = specimen();
    expect(
      customerDetails(
        {
          ...invoice.data.customer,
          address: {
            ...invoice.data.customer.address,
            lines: 'Calle Mayor, 12\n3º B',
          },
        },
        'es',
        'invoice:1',
      ),
    ).toEqual({
      name: 'Example Company',
      email: 'accounts@example.org',
      address: {
        line1: 'Calle Mayor, 12',
        line2: '3º B',
        city: 'Las Palmas de Gran Canaria',
        state: 'Las Palmas',
        postal_code: '35001',
        country: 'ES',
      },
      preferred_locales: ['es'],
      metadata: { customer: 'invoice:1' },
    });
  });
});

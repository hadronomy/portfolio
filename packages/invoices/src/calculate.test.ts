import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { specimen } from './fixtures';
import { newInvoice, newLine } from './model';
import { issueErrors } from './validate';

describe('invoice arithmetic', () => {
  it('uses decimal quantities without floating point drift', () => {
    const d = newInvoice().data;
    expect(
      calculate({
        ...d,
        lines: [{ ...newLine(), quantity: '3', unitPrice: '0.1' }],
      }).total,
    ).toBe('0.32');
  });
  it('rounds tax at the group, then reconciles line tax', () => {
    const d = newInvoice().data;
    const result = calculate({
      ...d,
      lines: [1, 2, 3].map(() => ({ ...newLine(), unitPrice: '0.05' })),
    });
    expect(result.tax).toBe('0.01');
    expect(result.lines.map((l) => l.tax)).toEqual(['0.00', '0.00', '0.01']);
  });
  it('allocates a fixed discount across mixed tax groups', () => {
    const d = newInvoice().data;
    const result = calculate({
      ...d,
      discount: { kind: 'amount', value: '10' },
      lines: [
        { ...newLine(), unitPrice: '100' },
        {
          ...newLine(),
          unitPrice: '100',
          tax: { treatment: 'taxable', rate: '3', reason: '' },
        },
      ],
    });
    expect(result.net).toBe('190.00');
    expect(result.tax).toBe('9.50');
    expect(result.total).toBe('199.50');
  });
  it('applies professional withholding to the net base', () => {
    const d = newInvoice().data;
    const result = calculate({
      ...d,
      withholdingRate: '15',
      lines: [{ ...newLine(), unitPrice: '1000' }],
    });
    expect(result.tax).toBe('70.00');
    expect(result.withholding).toBe('150.00');
    expect(result.total).toBe('920.00');
  });
  it('keeps disbursements outside tax and withholding', () => {
    const d = newInvoice().data;
    const result = calculate({
      ...d,
      withholdingRate: '15',
      lines: [
        { ...newLine(), unitPrice: '1000' },
        {
          ...newLine(),
          kind: 'disbursement',
          unitPrice: '30',
          tax: {
            treatment: 'outside-scope',
            rate: '0',
            reason: 'Paid in the customer name',
          },
        },
      ],
    });
    expect(result.total).toBe('950.00');
  });
  it('keeps exempt and zero-rated bases separate', () => {
    const d = newInvoice().data;
    const result = calculate({
      ...d,
      lines: [
        {
          ...newLine(),
          unitPrice: '100',
          tax: { treatment: 'taxable', rate: '0', reason: '' },
        },
        {
          ...newLine(),
          unitPrice: '100',
          tax: { treatment: 'exempt', rate: '0', reason: 'Exemption basis' },
        },
      ],
    });
    expect(result.groups).toHaveLength(2);
    expect(result.total).toBe('200.00');
  });
  it('handles negative rectification amounts', () => {
    const d = newInvoice().data;
    expect(
      calculate({
        ...d,
        kind: 'rectification',
        lines: [{ ...newLine(), quantity: '-1', unitPrice: '100' }],
      }).total,
    ).toBe('-107.00');
  });
});
describe('issue policy', () => {
  it('accepts a complete ordinary IGIC invoice', () =>
    expect(issueErrors(specimen().data)).toEqual([]));
  it('rejects company REPEP and professional withholding', () => {
    const d = specimen().data;
    const paths = issueErrors({
      ...d,
      issuer: { ...d.issuer, legalForm: 'company', regime: 'repep' },
      withholdingRate: '15',
    }).map((i) => i.path);
    expect(paths).toContain('issuer.regime');
    expect(paths).toContain('withholdingRate');
  });
  it('requires a legal basis for exemptions', () => {
    const d = specimen().data;
    expect(
      issueErrors({
        ...d,
        lines: [
          {
            ...newLine(),
            description: 'Service',
            tax: { treatment: 'exempt', rate: '0', reason: '' },
          },
        ],
      }).some((i) => i.path === 'lines.0.tax'),
    ).toBe(true);
  });
  it('rejects an impossible date and a missing customer', () => {
    const d = newInvoice().data;
    const errors = issueErrors({ ...d, issueDate: '2026-02-30' });
    expect(errors.some((i) => i.path === 'issueDate')).toBe(true);
    expect(errors.some((i) => i.path === 'customer.taxId')).toBe(true);
  });
});

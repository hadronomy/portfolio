import Decimal from 'decimal.js';
import { calculate } from './calculate';
import type { InvoiceData } from './model';
import { igicRates, repepLegend } from './tax-policy';
/** One field-addressed issuance blocker. */
export interface Issue {
  readonly path: string;
  readonly message: string;
}
const realDate = (day: string) =>
  Number.isFinite(Date.parse(`${day}T12:00:00Z`)) &&
  new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
/** Returns field-addressed errors. Saving drafts permits incomplete fields; issuing does not. */
export function issueErrors(data: InvoiceData): readonly Issue[] {
  const errors: Issue[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });
  (['issuer', 'customer'] as const).forEach((role) => {
    (
      ['name', 'taxId', 'address', 'postalCode', 'city', 'country'] as const
    ).forEach((field) => {
      if (!data[role][field].trim())
        add(
          `${role}.${field}`,
          `Enter the ${role} ${field === 'taxId' ? 'tax ID' : field}.`,
        );
    });
  });
  (['issueDate', 'supplyDate', 'dueDate'] as const).forEach((field) => {
    if (!realDate(data[field])) add(field, 'Enter a valid calendar date.');
  });
  if (data.dueDate < data.issueDate)
    add('dueDate', 'The due date must be on or after the issue date.');
  if (data.issuer.effectiveFrom > data.supplyDate)
    add(
      'issuer.effectiveFrom',
      'This issuer profile is not effective on the issue date.',
    );
  if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(data.series))
    add('series', 'Use 1–16 uppercase letters, numbers, or hyphens.');
  if (data.issuer.legalForm === 'company' && data.issuer.regime === 'repep')
    add(
      'issuer.regime',
      'REPEP is available to eligible natural persons, not companies.',
    );
  if (data.kind === 'rectification' && !data.correction?.reason.trim())
    add(
      'correction.reason',
      'Identify the original invoice and the reason for rectification.',
    );
  if (data.kind !== 'rectification' && data.correction)
    add('correction', 'Only a rectifying invoice can reference a correction.');
  if (!data.lines.some((line) => line.kind !== 'note'))
    add('lines', 'Add at least one invoice item.');
  if (new Set(data.lines.map((line) => line.id)).size !== data.lines.length)
    add('lines', 'Invoice item identifiers must be unique.');
  data.lines.forEach((line, index) => {
    const path = `lines.${index}`;
    if (!line.description.trim())
      add(`${path}.description`, 'Describe this item.');
    if (line.kind === 'note') return;
    const quantity = new Decimal(line.quantity),
      price = new Decimal(line.unitPrice),
      discount = new Decimal(line.discount.value),
      rate = new Decimal(line.tax.rate);
    if (
      quantity.isZero() ||
      (data.kind !== 'rectification' && quantity.isNegative())
    )
      add(
        `${path}.quantity`,
        'Enter a positive quantity. Negative adjustments require a rectifying invoice.',
      );
    if (price.isNegative())
      add(`${path}.unitPrice`, 'The unit price cannot be negative.');
    if (
      discount.isNegative() ||
      (line.discount.kind === 'percent' && discount.gt(100)) ||
      (line.discount.kind === 'amount' &&
        discount.gt(quantity.mul(price).abs()))
    )
      add(`${path}.discount`, 'The discount must fit within the item amount.');
    if (
      line.tax.treatment !== 'taxable' &&
      (!rate.isZero() || !line.tax.reason.trim())
    )
      add(
        `${path}.tax`,
        'This tax treatment requires a zero charged rate and its legal basis.',
      );
    if (
      line.tax.treatment === 'taxable' &&
      !igicRates.some((value) => rate.eq(value))
    )
      add(`${path}.tax.rate`, 'Enter a valid IGIC rate.');
    if (
      data.issuer.regime === 'repep' &&
      data.customerTerritory === 'canary-islands' &&
      line.kind !== 'disbursement' &&
      line.tax.treatment !== 'exempt'
    )
      add(
        `${path}.tax`,
        'Use the applicable REPEP exemption for local operations.',
      );
    if (
      line.kind === 'disbursement' &&
      (line.tax.treatment !== 'outside-scope' || !discount.isZero())
    )
      add(
        `${path}.tax`,
        'Disbursements need an outside-scope basis and cannot include a discount.',
      );
  });
  const discount = new Decimal(data.discount.value);
  if (
    discount.isNegative() ||
    (data.discount.kind === 'percent' && discount.gt(100))
  )
    add('discount', 'The discount must be nonnegative and no more than 100%.');
  const totals = calculate(data);
  if (
    data.discount.kind === 'amount' &&
    discount.gt(new Decimal(totals.subtotal).abs())
  )
    add('discount', 'The discount exceeds the invoice subtotal.');
  const withholding = new Decimal(data.withholdingRate);
  if (withholding.isNegative() || withholding.gt(100))
    add('withholdingRate', 'Enter a valid withholding rate.');
  if (data.customerType === 'consumer' && !withholding.isZero())
    add(
      'withholdingRate',
      'Consumer invoices do not apply professional withholding.',
    );
  if (data.issuer.legalForm === 'company' && !withholding.isZero())
    add(
      'withholdingRate',
      'Professional IRPF withholding does not apply to a company issuer.',
    );
  if (data.currency !== 'EUR')
    add(
      'currency',
      'Issuance in another currency needs an approved EUR tax conversion. Save this document as a draft.',
    );
  if (!withholding.isZero()) {
    if (
      data.issuer.activity !== 'professional' ||
      !data.customerWithholdingPayer
    )
      add(
        'withholdingRate',
        'Professional withholding requires a professional issuer and a withholding payer.',
      );
    if (
      (withholding.eq(15) &&
        data.withholdingReason !== 'general-professional') ||
      (withholding.eq(7) && data.withholdingReason !== 'new-professional') ||
      (!withholding.eq(7) && !withholding.eq(15))
    )
      add(
        'withholdingReason',
        'Select the supported professional withholding basis.',
      );
    if (
      withholding.eq(7) &&
      (!data.issuer.professionalStartYear ||
        Number(data.supplyDate.slice(0, 4)) <
          data.issuer.professionalStartYear ||
        Number(data.supplyDate.slice(0, 4)) >
          data.issuer.professionalStartYear + 2)
    )
      add(
        'issuer.professionalStartYear',
        'The reduced professional rate requires the start year and its two following tax years.',
      );
  }
  if (data.issuer.regime === 'repep') {
    if (
      !data.issuer.canaryEstablished ||
      data.issuer.repepCensus !== 'included' ||
      !data.issuer.repepReference.trim()
    )
      add(
        'issuer.repepReference',
        'Record Canary establishment and the effective REPEP census declaration.',
      );
    if (data.issuer.repepUntil && data.supplyDate >= data.issuer.repepUntil)
      add('issuer.repepUntil', 'REPEP is not effective on the operation date.');
    const year = Number(data.supplyDate.slice(0, 4));
    const threshold =
      year >= 2027
        ? 50000
        : year === 2026 && data.issuer.repepTransition
          ? 50000
          : 30000;
    if (
      data.issuer.repepTurnoverYear !== year - 1 ||
      new Decimal(data.issuer.repepTurnover).gt(threshold)
    )
      add(
        'issuer.repepTurnover',
        'Check the prior-year turnover and the applicable REPEP eligibility threshold.',
      );
    if (
      year === 2026 &&
      data.issuer.repepTransition &&
      data.supplyDate < '2026-07-01'
    )
      add(
        'issuer.effectiveFrom',
        'The 2026 transition cannot apply before the election period.',
      );
    data.lines.forEach((line, index) => {
      if (
        data.customerTerritory === 'canary-islands' &&
        line.kind !== 'note' &&
        line.kind !== 'disbursement' &&
        !line.tax.reason.includes(repepLegend)
      )
        add(
          `lines.${index}.tax.reason`,
          'Include the statutory REPEP exemption statement.',
        );
    });
  }
  return errors;
}

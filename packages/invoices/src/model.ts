import { Schema } from 'effect';

const DecimalText = Schema.String.check(
  Schema.isPattern(/^-?\d{1,12}(?:\.\d{1,6})?$/),
);
const DateText = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
export const InvoiceId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand('InvoiceId'),
);
export type InvoiceId = typeof InvoiceId.Type;
export const RecordId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand('RecordId'),
);
export type RecordId = typeof RecordId.Type;
export const Language = Schema.Literals(['en', 'es']);
export type Language = typeof Language.Type;
export const Party = Schema.Struct({
  name: Schema.String,
  taxId: Schema.String,
  address: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
});
export interface Party extends Schema.Schema.Type<typeof Party> {}
export const Issuer = Schema.Struct({
  ...Party.fields,
  legalForm: Schema.Literals(['sole-trader', 'company']),
  regime: Schema.Literals(['ordinary', 'repep']),
  activity: Schema.Literals(['professional', 'business']),
  canaryEstablished: Schema.Boolean,
  repepCensus: Schema.Literals(['included', 'not-included']),
  repepReference: Schema.String,
  repepUntil: Schema.NullOr(DateText),
  repepTurnoverYear: Schema.Number.check(Schema.isInt()),
  repepTurnover: DecimalText,
  repepTransition: Schema.Boolean,
  professionalStartYear: Schema.NullOr(Schema.Number.check(Schema.isInt())),
  effectiveFrom: DateText,
  iban: Schema.String,
  bankName: Schema.String,
  bic: Schema.String,
  website: Schema.String,
});
export interface Issuer extends Schema.Schema.Type<typeof Issuer> {}
export const Tax = Schema.Struct({
  treatment: Schema.Literals([
    'taxable',
    'exempt',
    'outside-scope',
    'reverse-charge',
  ]),
  rate: DecimalText,
  reason: Schema.String,
});
export interface Tax extends Schema.Schema.Type<typeof Tax> {}
export const Adjustment = Schema.Struct({
  kind: Schema.Literals(['percent', 'amount']),
  value: DecimalText,
});
export interface Adjustment extends Schema.Schema.Type<typeof Adjustment> {}
export const Line = Schema.Struct({
  id: RecordId,
  kind: Schema.Literals([
    'service',
    'product',
    'time',
    'expense',
    'shipping',
    'fee',
    'disbursement',
    'note',
  ]),
  description: Schema.String,
  quantity: DecimalText,
  unit: Schema.String,
  unitPrice: DecimalText,
  discount: Adjustment,
  tax: Tax,
  withholding: Schema.Boolean,
});
export interface Line extends Schema.Schema.Type<typeof Line> {}
export const InvoiceData = Schema.Struct({
  kind: Schema.Literals(['invoice', 'rectification', 'proforma']),
  language: Language,
  currency: Schema.Literals(['EUR', 'USD', 'GBP']),
  title: Schema.String,
  issuer: Issuer,
  customer: Party,
  customerId: Schema.NullOr(RecordId),
  customerType: Schema.Literals(['business', 'consumer']),
  customerTerritory: Schema.Literals([
    'canary-islands',
    'mainland-spain',
    'eu',
    'other',
  ]),
  issueDate: DateText,
  supplyDate: DateText,
  dueDate: DateText,
  series: Schema.String,
  lines: Schema.Array(Line),
  discount: Adjustment,
  withholdingRate: DecimalText,
  withholdingReason: Schema.Literals([
    'none',
    'general-professional',
    'new-professional',
  ]),
  customerWithholdingPayer: Schema.Boolean,
  notes: Schema.String,
  paymentTerms: Schema.String,
  reference: Schema.String,
  correction: Schema.NullOr(
    Schema.Struct({
      invoiceId: InvoiceId,
      number: Schema.String,
      reason: Schema.String,
    }),
  ),
});
export interface InvoiceData extends Schema.Schema.Type<typeof InvoiceData> {}
export const Invoice = Schema.Struct({
  id: InvoiceId,
  data: InvoiceData,
  revision: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
  ),
  status: Schema.Literals(['draft', 'issued']),
  number: Schema.NullOr(Schema.String),
  issuedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  calculationVersion: Schema.Literal(1),
});
export interface Invoice extends Schema.Schema.Type<typeof Invoice> {}
export const Customer = Schema.Struct({
  id: RecordId,
  ...Party.fields,
  type: Schema.Literals(['business', 'consumer']),
  territory: Schema.Literals([
    'canary-islands',
    'mainland-spain',
    'eu',
    'other',
  ]),
  language: Language,
});
export interface Customer extends Schema.Schema.Type<typeof Customer> {}
export const CatalogItem = Schema.Struct({
  ...Line.fields,
  name: Schema.String,
});
export interface CatalogItem extends Schema.Schema.Type<typeof CatalogItem> {}
export const Payment = Schema.Struct({
  id: RecordId,
  invoiceId: InvoiceId,
  amount: DecimalText,
  date: DateText,
  method: Schema.Literals(['transfer', 'cash', 'card', 'other']),
  reference: Schema.String,
  createdAt: Schema.String,
  reversedAt: Schema.NullOr(Schema.String),
});
export interface Payment extends Schema.Schema.Type<typeof Payment> {}
export const Preferences = Schema.Struct({
  issuer: Issuer,
  language: Language,
  defaultTerms: Schema.String,
  defaultSeries: Schema.String,
});
export interface Preferences extends Schema.Schema.Type<typeof Preferences> {}
export class InvalidInvoice extends Schema.TaggedError<InvalidInvoice>()(
  'InvalidInvoice',
  {
    issues: Schema.Array(
      Schema.Struct({ path: Schema.String, message: Schema.String }),
    ),
  },
) {}
export class MissingInvoice extends Schema.TaggedError<MissingInvoice>()(
  'MissingInvoice',
  { id: Schema.String },
) {}
export class RevisionConflict extends Schema.TaggedError<RevisionConflict>()(
  'RevisionConflict',
  { current: Invoice },
) {}
export class StorageFailure extends Schema.TaggedError<StorageFailure>()(
  'StorageFailure',
  { message: Schema.String },
) {}
export const blankParty: Party = {
  name: '',
  taxId: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'ES',
  email: '',
};
export const defaultPreferences: Preferences = {
  issuer: {
    ...blankParty,
    legalForm: 'sole-trader',
    regime: 'ordinary',
    activity: 'professional',
    canaryEstablished: true,
    repepCensus: 'not-included',
    repepReference: '',
    repepUntil: null,
    repepTurnoverYear: 2025,
    repepTurnover: '0',
    repepTransition: false,
    professionalStartYear: null,
    effectiveFrom: '2026-01-01',
    iban: '',
    bankName: '',
    bic: '',
    website: '',
  },
  language: 'en',
  defaultTerms: 'Payment by bank transfer within 30 days.',
  defaultSeries: 'INV',
};
/** Creates an unnumbered document. Issuance allocates its number in the database transaction. */
export function newInvoice(
  preferences: Preferences = defaultPreferences,
  now = new Date(),
): Invoice {
  const day = now.toISOString().slice(0, 10);
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + 30);
  return {
    id: InvoiceId.make(crypto.randomUUID()),
    revision: 1,
    status: 'draft',
    number: null,
    issuedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    calculationVersion: 1,
    data: {
      kind: 'invoice',
      language: preferences.language,
      currency: 'EUR',
      title: '',
      issuer: preferences.issuer,
      customer: blankParty,
      customerId: null,
      customerType: 'business',
      customerTerritory: 'canary-islands',
      issueDate: day,
      supplyDate: day,
      dueDate: due.toISOString().slice(0, 10),
      series: preferences.defaultSeries,
      lines: [newLine()],
      discount: { kind: 'percent', value: '0' },
      withholdingRate: '0',
      withholdingReason: 'none',
      customerWithholdingPayer: true,
      notes: '',
      paymentTerms: preferences.defaultTerms,
      reference: '',
      correction: null,
    },
  };
}
export function newLine(): Line {
  return {
    id: RecordId.make(crypto.randomUUID()),
    kind: 'service',
    description: '',
    quantity: '1',
    unit: 'unit',
    unitPrice: '0',
    discount: { kind: 'percent', value: '0' },
    withholding: true,
    tax: { treatment: 'taxable', rate: '7', reason: '' },
  };
}

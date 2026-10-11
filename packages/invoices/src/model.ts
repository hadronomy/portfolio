import { Schema } from 'effect';
import { Address, blankAddress } from './address';
import { blankPages, Pages } from './pages';

/** A decimal amount as text: money, quantities, and rates cross the wire this way. */
export const DecimalText = Schema.String.check(
  Schema.isPattern(/^-?\d{1,12}(?:\.\d{1,6})?$/),
);
export const DateText = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/),
);
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
export const Currency = Schema.Literals(['EUR', 'USD', 'GBP']);
export type Currency = typeof Currency.Type;
/** Header art printed above the document. `none` prints a plain page. */
export const Cover = Schema.Literals(['none', 'ember', 'tide', 'moss', 'rose']);
export type Cover = typeof Cover.Type;
/** DID of the workspace owner. Store methods take it as the audit actor so anonymous strings never reach the audit log. */
export const OwnerDid = Schema.String.pipe(Schema.brand('OwnerDid'));
export type OwnerDid = typeof OwnerDid.Type;
/** Who changed a record: the owner, or Stripe when it settles a payment on its own. */
export const Actor = Schema.Union([
  OwnerDid,
  Schema.Literals(['system:stripe', 'customer']),
]);
export type Actor = typeof Actor.Type;
export const Party = Schema.Struct({
  name: Schema.String,
  taxId: Schema.String,
  email: Schema.String,
  address: Address,
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
/** What a quote adds to a document: how long the offer stands, and its pages. */
export const QuoteTerms = Schema.Struct({
  validUntil: DateText,
  pages: Pages,
});
export interface QuoteTerms extends Schema.Schema.Type<typeof QuoteTerms> {}
const InvoiceFields = Schema.Struct({
  /**
   * An invoice and a rectifying invoice are tax documents. A quote
   * (presupuesto) is an offer: it binds once the customer accepts it, and
   * never has tax effect or an invoice number.
   */
  kind: Schema.Literals(['invoice', 'rectification', 'quote']),
  language: Language,
  currency: Currency,
  cover: Cover,
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
  /** Set on a quote, and only on a quote. */
  quote: Schema.NullOr(QuoteTerms),
});
export const InvoiceData = InvoiceFields.check(
  Schema.makeFilter((data) =>
    (data.kind === 'quote') === (data.quote !== null)
      ? undefined
      : { path: ['quote'], issue: 'Only a quote has quote terms.' },
  ),
);
export interface InvoiceData extends Schema.Schema.Type<typeof InvoiceFields> {}
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
  // `stripe` marks a payment Stripe settled; its reference is the Stripe
  // invoice payment it came from.
  method: Schema.Literals(['transfer', 'cash', 'card', 'other', 'stripe']),
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
  cover: Cover,
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
  { id: Schema.Union([InvoiceId, RecordId]) },
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
  email: '',
  address: blankAddress('ES'),
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
  cover: 'ember',
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
      cover: preferences.cover,
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
      quote: null,
    },
  };
}

/** Fresh quote terms: valid for 30 days from `issueDate`, nothing written yet. */
export function quoteTerms(issueDate: string): QuoteTerms {
  const until = new Date(`${issueDate}T12:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 30);
  return { validUntil: until.toISOString().slice(0, 10), pages: blankPages };
}

/** A document turned into a quote, keeping any terms it already has. */
export function asQuote(data: InvoiceData): InvoiceData {
  return {
    ...data,
    kind: 'quote',
    correction: null,
    quote: data.quote ?? quoteTerms(data.issueDate),
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

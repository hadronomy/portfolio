import {
  Adjustment,
  CatalogItem,
  Cover,
  Currency,
  Customer,
  DateText,
  DecimalText,
  InvoiceData,
  InvoiceId,
  Language,
  Line,
  Payment,
  Preferences,
  RecordId,
} from '@portfolio/invoices/model';
import { MailDelivery } from '@portfolio/invoices/outbox-model';
import { Offer, PaymentPlan, PlanLibrary } from '@portfolio/invoices/plan';
import { DetailsState } from '@portfolio/invoices/quote-details';
import {
  EmailAddress,
  QuoteEmail,
  QuoteResponse,
} from '@portfolio/invoices/quote-model';
import { Schema } from 'effect';
import { Tool, Toolkit } from 'effect/ai';

// What an agent can do in the invoices workspace, as MCP tools: everything
// the owner can do in the invoice pages, and nothing a customer does. Each
// tool runs the same operation its page does, so the two can never differ.
//
// The words here are the agent's whole manual. A description says when to
// use the tool, what it changes, and what comes back; a failure says what
// to do next. Tools take document numbers as well as IDs, and lines without
// IDs, so an agent never has to invent one.

/** Why a tool could not do what it was asked, in words that say what to do next. */
export class ToolFailure extends Schema.TaggedError<ToolFailure>()(
  'ToolFailure',
  { message: Schema.String },
) {}

const described = <S extends Schema.Top>(schema: S, description: string) =>
  schema.annotate({ description });

/** A quote's answer as agents read it: the evidence, and whether it was signed, without the drawing. */
const { signature: _drawing, ...answerFields } = QuoteResponse.fields;
const AgentAnswer = Schema.Struct({
  ...answerFields,
  signed: described(
    Schema.Boolean,
    'Whether the customer drew their signature. Every acceptance has one; the owner sees it on the quote.',
  ),
});

const DocumentRef = described(
  Schema.String,
  'A document: its ID, or its number, such as INV-2026-0003 or P-2026-0001.',
);

const Kind = Schema.Literals(['invoice', 'rectification', 'quote']);

const Status = described(
  Schema.Literals([
    'draft',
    'unpaid',
    'overdue',
    'paid',
    'open',
    'accepted',
    'declined',
    'expired',
    'invoiced',
  ]),
  'Invoices are draft, unpaid, overdue or paid. Quotes are draft, open (sent, awaiting an answer), expired, accepted, declined, or invoiced (every payment billed).',
);

/** One document in a list: enough to choose it and see where it stands. */
export const DocumentRow = Schema.Struct({
  id: InvoiceId,
  number: Schema.NullOr(Schema.String),
  kind: Kind,
  status: Status,
  title: Schema.String,
  customer: Schema.String,
  issueDate: DateText,
  dueDate: DateText,
  validUntil: Schema.NullOr(DateText),
  currency: Currency,
  total: DecimalText,
  outstanding: DecimalText,
});
export interface DocumentRow extends Schema.Schema.Type<typeof DocumentRow> {}

/** A line as an agent writes it. Anything left out takes the editor's default. */
export const LineInput = Schema.Struct({
  id: described(
    Schema.optional(RecordId),
    'Keep the ID of a line you are changing; leave it out for a new line.',
  ),
  kind: Schema.optional(Line.fields.kind),
  description: Schema.String,
  quantity: described(Schema.optional(DecimalText), 'Defaults to 1.'),
  unit: described(
    Schema.optional(Schema.String),
    'unit, hour, day, jornada… Defaults to unit.',
  ),
  unitPrice: described(DecimalText, 'Before tax, such as 850.00.'),
  discount: Schema.optional(Adjustment),
  tax: described(
    Schema.optional(Line.fields.tax),
    'Defaults to IGIC at 7% (taxable). Use exempt, outside-scope or reverse-charge with a reason.',
  ),
  withholding: described(
    Schema.optional(Schema.Boolean),
    'Whether IRPF withholding applies to this line. Defaults to true.',
  ),
});
export interface LineInput extends Schema.Schema.Type<typeof LineInput> {}

/** What a draft can change. Fields left out keep their value. */
export const DraftChanges = Schema.Struct({
  title: Schema.optional(Schema.String),
  customer: described(
    Schema.optional(RecordId),
    'A customer from list_customers. Copies their details, type, territory and language onto the document.',
  ),
  language: Schema.optional(Language),
  currency: Schema.optional(Currency),
  cover: Schema.optional(Cover),
  issueDate: Schema.optional(DateText),
  supplyDate: described(
    Schema.optional(DateText),
    'When the work is done; on a quote, its planned start.',
  ),
  dueDate: described(
    Schema.optional(DateText),
    'When an invoice falls due; on a quote, its planned delivery.',
  ),
  validUntil: described(
    Schema.optional(DateText),
    'Quotes only: the last day the customer can accept.',
  ),
  lines: described(
    Schema.optional(Schema.Array(LineInput)),
    'The whole list of lines, in order. It replaces the lines the document has.',
  ),
  discount: described(
    Schema.optional(Adjustment),
    'A discount on the whole document.',
  ),
  notes: Schema.optional(Schema.String),
  paymentTerms: Schema.optional(Schema.String),
  reference: Schema.optional(Schema.String),
  pages: described(
    Schema.optional(Schema.String),
    'Quotes only: the proposal pages as Markdown. Headings, lists, tables, quotes and links work. `::page-break` on its own line starts a new page, and `::clause[id@version]` on its own line places a clause from list_clauses.',
  ),
});
export interface DraftChanges extends Schema.Schema.Type<typeof DraftChanges> {}

const Totals = Schema.Struct({
  subtotal: DecimalText,
  discount: DecimalText,
  tax: DecimalText,
  withholding: DecimalText,
  total: DecimalText,
});

/** A document in full, as get_document returns it. */
export const DocumentDetail = Schema.Struct({
  ...DocumentRow.fields,
  revision: described(
    Schema.Number,
    'Pass it back to update_draft or issue_document, so a change never overwrites one you have not seen.',
  ),
  data: InvoiceData,
  totals: Totals,
  issueBlockers: described(
    Schema.Array(
      Schema.Struct({ path: Schema.String, message: Schema.String }),
    ),
    'What stops a draft from being issued. Empty when it can be issued.',
  ),
  payments: Schema.Array(Payment),
  plans: described(
    Schema.Array(PaymentPlan),
    'The payment plans the customer can choose from.',
  ),
  chosenPlan: Schema.NullOr(RecordId),
  pages: described(
    Schema.NullOr(Schema.String),
    'A quote’s proposal pages, as Markdown.',
  ),
  answer: described(
    Schema.NullOr(AgentAnswer),
    'A quote’s answer from its customer, with the evidence it rests on and the payments billed so far.',
  ),
  pdf: described(
    Schema.String,
    'The address of the document’s PDF, a resource to read, in the document’s language. Swap en and es at the end for the other.',
  ),
  openLinks: described(
    Schema.Number,
    'How many links to this document are open: payment links on an invoice, answer links on a quote.',
  ),
  emails: described(
    Schema.Array(QuoteEmail),
    'Every time a quote was emailed to its customer, newest first. Empty for an invoice.',
  ),
  details: described(
    Schema.NullOr(DetailsState),
    'Quote customer details: waiting, confirmed with date and changes, or needs-revision with the territory or type reason. Null for invoices.',
  ),
  deliveries: described(
    Schema.Array(MailDelivery),
    'Email delivery records, one per recipient. Pending emails retry automatically. Sent means the provider accepted the message. Use retry_email with a delivery ID to retry it now.',
  ),
});

const Created = Schema.Struct({
  document: DocumentRow,
});

const Link = Schema.Struct({
  url: described(
    Schema.String,
    'Send it to the customer. It is shown only this once.',
  ),
  expiresAt: Schema.String,
});

const Closed = Schema.Struct({ closed: Schema.Number });

const Done = Schema.Struct({ ok: Schema.Literal(true) });

type Config = {
  readonly parameters: Schema.Constraint;
  readonly success: Schema.Constraint;
  readonly failure: Schema.Constraint;
  readonly failureMode: Tool.FailureMode;
};

/** The MCP hints for a tool that only reads. */
const read = <N extends string, C extends Config, R>(
  tool: Tool.Tool<N, C, R>,
) =>
  tool
    .annotate(Tool.Readonly, true)
    .annotate(Tool.Destructive, false)
    .annotate(Tool.Idempotent, true)
    .annotate(Tool.OpenWorld, false);

/** The MCP hints for a tool that changes the workspace. */
const write = <N extends string, C extends Config, R>(
  tool: Tool.Tool<N, C, R>,
  hints: { destructive?: boolean; idempotent?: boolean } = {},
) =>
  tool
    .annotate(Tool.Readonly, false)
    .annotate(Tool.Destructive, hints.destructive ?? false)
    .annotate(Tool.Idempotent, hints.idempotent ?? false)
    .annotate(Tool.OpenWorld, false);

export const ListDocuments = read(
  Tool.make('list_documents', {
    description:
      'Lists invoices and quotes, newest first, with where each stands and what is still owed. Start here to find a document; then read it with get_document.',
    parameters: Schema.Struct({
      kind: Schema.optional(Kind),
      status: Schema.optional(Status),
      search: described(
        Schema.optional(Schema.String),
        'Matches the number, title or customer name.',
      ),
      limit: described(
        Schema.optional(Schema.Int),
        'At most this many, 25 by default and 100 at most.',
      ),
    }),
    success: Schema.Struct({
      documents: Schema.Array(DocumentRow),
      more: described(Schema.Number, 'How many more match beyond the limit.'),
    }),
    failure: ToolFailure,
  }),
);

export const GetDocument = read(
  Tool.make('get_document', {
    description:
      'Reads one invoice or quote in full: its data and totals, what blocks issuing a draft, payments, payment plans, a quote’s pages and its customer’s answer, its customer details state and any required owner revision, and how many links are open.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: DocumentDetail,
    failure: ToolFailure,
  }),
);

export const ListCustomers = read(
  Tool.make('list_customers', {
    description:
      'Lists the saved customers, with their details, whether each is a business or a consumer, and where they are. Documents take a customer by ID.',
    parameters: Schema.Struct({
      search: described(
        Schema.optional(Schema.String),
        'Matches the name, tax ID or email.',
      ),
    }),
    success: Schema.Struct({ customers: Schema.Array(Customer) }),
    failure: ToolFailure,
  }),
);

export const ListCatalog = read(
  Tool.make('list_catalog', {
    description:
      'Lists the saved catalog items: lines the owner bills often, with price, unit and tax. Copy one into a document’s lines.',
    parameters: Schema.Struct({
      search: Schema.optional(Schema.String),
    }),
    success: Schema.Struct({ items: Schema.Array(CatalogItem) }),
    failure: ToolFailure,
  }),
);

export const GetSettings = read(
  Tool.make('get_settings', {
    description:
      'Reads the issuer’s details and defaults (language, series, payment terms, cover), and the library of payment plans with the ones offered by default.',
    parameters: Tool.EmptyParams,
    success: Schema.Struct({
      preferences: Preferences,
      library: PlanLibrary,
    }),
    failure: ToolFailure,
  }),
);

export const ListClauses = read(
  Tool.make('list_clauses', {
    description:
      'Lists the published clauses a quote’s pages can place with `::clause[id@version]`: their titles and words in both languages, the law each follows, and whether it is for business customers only. A business-only clause is void against consumers and refused on their quotes.',
    parameters: Tool.EmptyParams,
    success: Schema.Struct({
      clauses: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          version: Schema.Number,
          audience: Schema.Literals(['everyone', 'business']),
          source: Schema.String,
          en: Schema.Struct({ title: Schema.String, body: Schema.String }),
          es: Schema.Struct({ title: Schema.String, body: Schema.String }),
        }),
      ),
    }),
    failure: ToolFailure,
  }),
);

export const CreateDraft = write(
  Tool.make('create_draft', {
    description:
      'Creates a draft invoice or quote from the owner’s defaults, then applies the changes given. A quote starts valid for 30 days. Nothing reaches the customer until the draft is issued and sent.',
    parameters: Schema.Struct({
      kind: Schema.Literals(['invoice', 'quote']),
      changes: Schema.optional(DraftChanges),
    }),
    success: Created,
    failure: ToolFailure,
  }),
);

export const UpdateDraft = write(
  Tool.make('update_draft', {
    description:
      'Changes a draft. Only the fields given change. Issued documents never change: revise a quote, or rectify an invoice.',
    parameters: Schema.Struct({
      document: DocumentRef,
      revision: described(Schema.Number, 'The revision get_document returned.'),
      changes: DraftChanges,
    }),
    success: Created,
    failure: ToolFailure,
  }),
);

export const IssueDocument = write(
  Tool.make('issue_document', {
    description:
      'Issues a draft: it takes its number and can no longer change. An invoice becomes a tax record; a quote can then be sent. Check issueBlockers in get_document first. Calling it again for the same revision returns the same document.',
    parameters: Schema.Struct({
      document: DocumentRef,
      revision: Schema.Number,
    }),
    success: Created,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const DeleteDraft = write(
  Tool.make('delete_draft', {
    description:
      'Deletes a draft for good. Issued documents cannot be deleted.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Done,
    failure: ToolFailure,
  }),
  { destructive: true },
);

export const RectifyInvoice = write(
  Tool.make('rectify_invoice', {
    description:
      'Starts a draft rectifying invoice for an issued invoice, the only lawful way to correct one. Fill in the reason and the corrected lines, then issue it.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Created,
    failure: ToolFailure,
  }),
);

export const RecordPayment = write(
  Tool.make('record_payment', {
    description:
      'Records a payment the customer made outside online payment, such as a bank transfer. Online payments record themselves.',
    parameters: Schema.Struct({
      document: DocumentRef,
      amount: DecimalText,
      date: DateText,
      method: Schema.Literals(['transfer', 'cash', 'card', 'other']),
      reference: described(
        Schema.optional(Schema.String),
        'The bank reference or a note.',
      ),
    }),
    success: Schema.Struct({ payment: Payment, outstanding: DecimalText }),
    failure: ToolFailure,
  }),
);

export const ReversePayment = write(
  Tool.make('reverse_payment', {
    description:
      'Reverses a recorded payment, for one entered by mistake. The record stays, marked reversed.',
    parameters: Schema.Struct({
      payment: described(RecordId, 'The payment ID, from get_document.'),
    }),
    success: Done,
    failure: ToolFailure,
  }),
  { destructive: true },
);

export const SetPaymentPlans = write(
  Tool.make('set_payment_plans', {
    description:
      'Sets the payment plans a document offers its customer, up to four. A plan splits the total into parts (a share, or the rest) each due on a rule. On a quote the plans are counted from acceptance and fixed once it is issued. Pass null to go back to the defaults.',
    parameters: Schema.Struct({
      document: DocumentRef,
      plans: Schema.NullOr(Offer),
    }),
    success: Done,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const ChoosePaymentPlan = write(
  Tool.make('choose_payment_plan', {
    description:
      'Sets the plan an issued invoice is paid under, as agreed with the customer; null lets them choose again.',
    parameters: Schema.Struct({
      document: DocumentRef,
      plan: Schema.NullOr(RecordId),
    }),
    success: Done,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const SavePlanLibrary = write(
  Tool.make('save_plan_library', {
    description:
      'Replaces the library of reusable payment plans. A plan marked default is offered on every new document whose total reaches its threshold.',
    parameters: Schema.Struct({ library: PlanLibrary }),
    success: Done,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const SaveCustomer = write(
  Tool.make('save_customer', {
    description:
      'Adds a customer, or changes one when its ID is given. Documents already issued keep the details they were issued with.',
    parameters: Schema.Struct({
      customer: Schema.Struct({
        ...Customer.fields,
        id: Schema.optional(RecordId),
      }),
    }),
    success: Schema.Struct({ customer: Customer }),
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const ForgetCustomer = write(
  Tool.make('forget_customer', {
    description:
      'Removes a customer from the directory. Their documents stay as they are.',
    parameters: Schema.Struct({ customer: RecordId }),
    success: Done,
    failure: ToolFailure,
  }),
  { destructive: true, idempotent: true },
);

export const SaveCatalogItem = write(
  Tool.make('save_catalog_item', {
    description: 'Adds a catalog item, or changes one when its ID is given.',
    parameters: Schema.Struct({
      item: Schema.Struct({
        ...LineInput.fields,
        name: Schema.String,
      }),
    }),
    success: Schema.Struct({ item: CatalogItem }),
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const ForgetCatalogItem = write(
  Tool.make('forget_catalog_item', {
    description: 'Removes an item from the catalog.',
    parameters: Schema.Struct({ item: RecordId }),
    success: Done,
    failure: ToolFailure,
  }),
  { destructive: true, idempotent: true },
);

export const SaveSettings = write(
  Tool.make('save_settings', {
    description:
      'Replaces the issuer’s details and defaults. Read them with get_settings first and change only what you mean to. New documents use them; issued ones keep theirs.',
    parameters: Schema.Struct({ preferences: Preferences }),
    success: Done,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const ReviseQuote = write(
  Tool.make('revise_quote', {
    description:
      'Starts a new draft quote from an issued one, for changes after it was sent. The issued quote stays as the customer saw it.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Created,
    failure: ToolFailure,
  }),
);

export const BillQuotePayment = write(
  Tool.make('bill_quote_payment', {
    description:
      'Drafts the invoice for one payment of an accepted quote’s plan, with its share of every quoted line. Spanish law asks for an invoice for each payment taken. Calling it again for the same payment returns the same draft; issue it to bill the customer.',
    parameters: Schema.Struct({
      document: DocumentRef,
      payment: described(
        Schema.Int,
        'The payment’s place in the accepted plan, from 0.',
      ),
    }),
    success: Created,
    failure: ToolFailure,
  }),
  { idempotent: true },
);

export const SharePaymentLink = write(
  Tool.make('share_payment_link', {
    description:
      'Opens an issued invoice for online payment and returns a new link to send the customer, valid for 30 days.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Link,
    failure: ToolFailure,
  }),
);

export const ClosePaymentLinks = write(
  Tool.make('close_payment_links', {
    description: 'Closes every open payment link to an invoice.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Closed,
    failure: ToolFailure,
  }),
  { destructive: true, idempotent: true },
);

export const SendQuote = write(
  Tool.make('send_quote', {
    description:
      'Returns a new link for an issued quote. The customer reads it there, chooses a payment plan, and accepts with their name or declines; both sides then get the confirmation by email.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Link,
    failure: ToolFailure,
  }),
);

export const EmailQuote = write(
  Tool.make('email_quote', {
    description:
      'Queues an issued, open quote for its customer and tries delivery now. The email contains a link to read and sign it, with the PDF attached. Replies reach the owner. Use it when the customer needs an email invitation. Returns the recipient, link expiry and delivery state. Pending email retries automatically. Use retry_email to retry its delivery ID.',
    parameters: Schema.Struct({
      document: DocumentRef,
      to: described(
        Schema.optional(EmailAddress),
        'Where to send it. Defaults to the customer’s address on the quote.',
      ),
      note: described(
        Schema.optional(Schema.String.check(Schema.isMaxLength(1000))),
        'A few words from the owner, shown above the link, in the quote’s language.',
      ),
      copy: described(
        Schema.optional(Schema.Boolean),
        'Whether the owner gets a copy.',
      ),
    }),
    success: Schema.Struct({
      to: Schema.String,
      sentAt: Schema.NullOr(Schema.String),
      expiresAt: Schema.String,
      delivery: Schema.NullOr(MailDelivery),
    }),
    failure: ToolFailure,
  }),
  { destructive: true },
);

export const CloseQuoteLinks = write(
  Tool.make('close_quote_links', {
    description: 'Closes every open link to a quote.',
    parameters: Schema.Struct({ document: DocumentRef }),
    success: Closed,
    failure: ToolFailure,
  }),
  { destructive: true, idempotent: true },
);

export const RetryEmail = write(
  Tool.make('retry_email', {
    description:
      'Retries a queued or failed document email now. Read deliveries in get_document and pass its email ID. Sends through the same operation as the owner panel. Returns its state, attempts, last error and provider message ID. A sent email is returned unchanged. An active send or an uncertain delivery beyond the safe retry window is refused.',
    parameters: Schema.Struct({
      document: DocumentRef,
      email: Schema.String.check(Schema.isUUID()),
    }),
    success: MailDelivery,
    failure: ToolFailure,
  }),
  { destructive: true, idempotent: true },
);

/** Every tool an agent has. */
export const InvoiceTools = Toolkit.make(
  RetryEmail,
  ListDocuments,
  GetDocument,
  ListCustomers,
  ListCatalog,
  GetSettings,
  ListClauses,
  CreateDraft,
  UpdateDraft,
  IssueDocument,
  DeleteDraft,
  RectifyInvoice,
  RecordPayment,
  ReversePayment,
  SetPaymentPlans,
  ChoosePaymentPlan,
  SavePlanLibrary,
  SaveCustomer,
  ForgetCustomer,
  SaveCatalogItem,
  ForgetCatalogItem,
  SaveSettings,
  ReviseQuote,
  BillQuotePayment,
  SharePaymentLink,
  ClosePaymentLinks,
  SendQuote,
  EmailQuote,
  CloseQuoteLinks,
);

export type ToolName = keyof typeof InvoiceTools.tools;

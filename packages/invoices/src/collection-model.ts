import { Schema } from 'effect';
import { Cover, Currency, DecimalText, Language, RecordId } from '#model';
import { Options, Schedule } from '#plan';

// The shapes collection hands to the interface: the owner's view of where an
// invoice's payment stands, and the customer's page behind a payment link.
// They stay apart from the workflow so the browser can decode and match them
// without loading the server code that produces them.

/** Why Stripe's copy of an invoice needs the owner before it can be paid. */
export const Review = Schema.TaggedUnion({
  /** Stripe's totals did not match the invoice, so it was never finalized. */
  Mismatch: {
    differences: Schema.Array(
      Schema.Struct({
        field: Schema.String,
        expected: Schema.Union([Schema.String, Schema.Number]),
        actual: Schema.Union([Schema.String, Schema.Number]),
      }),
    ),
  },
  /** Stripe settled more than the ledger still had outstanding. */
  Overpaid: { payment: Schema.String },
  /** Stripe gave money back; the ledger owes that much again. */
  Refunded: { amount: DecimalText },
  /** Someone voided the Stripe invoice or wrote it off in the dashboard. */
  Closed: { status: Schema.Literals(['void', 'uncollectible']) },
});
export type Review = typeof Review.Type;

/** Where an invoice's collection stands, as the owner sees it. */
export const CollectionStatus = Schema.TaggedUnion({
  /** Not shared for payment. */
  Idle: {},
  /** Shared, but the Stripe side was interrupted; sharing again finishes it. */
  Preparing: {},
  /** Payable through any of its `links` that are still open. */
  Open: { links: Schema.Int },
  Paid: {},
  Review: { review: Review },
});
export type CollectionStatus = typeof CollectionStatus.Type;

/** One line as the customer reads it: what, how much of it, and its amount. */
export const CheckoutLine = Schema.Struct({
  description: Schema.String,
  quantity: DecimalText,
  unit: Schema.String,
  unitPrice: DecimalText,
  amount: DecimalText,
});
export interface CheckoutLine extends Schema.Schema.Type<typeof CheckoutLine> {}

/** What a payment link shows: the invoice, never the workspace around it. */
export const CheckoutInvoice = Schema.Struct({
  number: Schema.String,
  title: Schema.String,
  issuer: Schema.String,
  issuerEmail: Schema.String,
  /** The lines under each party's name, as the PDF prints them. */
  issuerLines: Schema.Array(Schema.String),
  customerLines: Schema.Array(Schema.String),
  customer: Schema.String,
  /** Prefills the payment form, so the customer types less. */
  customerEmail: Schema.String,
  customerCountry: Schema.String,
  issueDate: Schema.String,
  dueDate: Schema.String,
  language: Language,
  currency: Currency,
  cover: Cover,
  lines: Schema.Array(CheckoutLine),
  subtotal: DecimalText,
  discount: DecimalText,
  /** Tax charged, one entry per rate, as the PDF itemises it. */
  taxes: Schema.Array(
    Schema.Struct({ rate: DecimalText, amount: DecimalText }),
  ),
  withholding: DecimalText,
  disbursements: DecimalText,
  total: DecimalText,
  /** Payments the ledger holds, oldest first. */
  payments: Schema.Array(
    Schema.Struct({ date: Schema.String, amount: DecimalText }),
  ),
  remaining: DecimalText,
  /** The invoice's own notes to the customer. */
  notes: Schema.String,
});
export interface CheckoutInvoice
  extends Schema.Schema.Type<typeof CheckoutInvoice> {}

/** One plan the customer may pay under: its payments, and what it lets them pay now. */
export const PlanChoice = Schema.Struct({
  id: RecordId,
  name: Schema.String,
  schedule: Schedule,
  options: Options,
});
export interface PlanChoice extends Schema.Schema.Type<typeof PlanChoice> {}

/** An invoice's payment page, from the customer's side. */
export const Checkout = Schema.TaggedUnion({
  /**
   * The customer may pay, under any of `plans`, the page opening on
   * `selected`. Once a payment lands under one, it is `locked` and the only
   * plan left.
   */
  Payable: {
    invoice: CheckoutInvoice,
    plans: Schema.Array(PlanChoice).check(Schema.isMinLength(1)),
    selected: RecordId,
    locked: Schema.Boolean,
  },
  /** A payment of `amount` is on its way; another waits until it lands. */
  Processing: { invoice: CheckoutInvoice, amount: DecimalText },
  Paid: { invoice: CheckoutInvoice },
  /** Payment is paused until the owner reconciles the invoice. */
  Unavailable: { invoice: CheckoutInvoice },
});
export type Checkout = typeof Checkout.Type;

/** The browser's name for one press of the pay button. */
export const AttemptId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand('AttemptId'),
);
export type AttemptId = typeof AttemptId.Type;

/** Why a payment could not start. */
export const PayFailure = Schema.TaggedUnion({
  /** The invoice or its plan changed under the page; reload it. */
  Changed: {},
  /** Stripe or the database did not answer; nothing was charged. */
  Unreachable: {},
});
export type PayFailure = typeof PayFailure.Type;

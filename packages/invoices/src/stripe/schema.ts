import { Schema } from 'effect';

// The parts of Stripe's answers this application reads, and nothing more.
// Each shape decodes the wire form (snake_case) into the names the code uses,
// so a field Stripe renames or drops fails here, at the edge, instead of
// turning into `undefined` three calls later.

const prefixed = (prefix: string) =>
  Schema.String.check(Schema.isPattern(new RegExp(`^${prefix}_\\w+$`)));

export const StripeInvoiceId = prefixed('in').pipe(
  Schema.brand('StripeInvoiceId'),
);
export type StripeInvoiceId = typeof StripeInvoiceId.Type;

export const StripeCustomerId = prefixed('cus').pipe(
  Schema.brand('StripeCustomerId'),
);
export type StripeCustomerId = typeof StripeCustomerId.Type;

export const InvoicePaymentId = prefixed('inpay').pipe(
  Schema.brand('InvoicePaymentId'),
);
export type InvoicePaymentId = typeof InvoicePaymentId.Type;

/** An amount in the currency's smallest unit: cents for EUR, USD and GBP. */
export const Minor = Schema.Int.pipe(Schema.brand('Minor'));
export type Minor = typeof Minor.Type;

/** Where a Stripe invoice is in its life: only `draft` accepts lines. */
export const StripeInvoiceStatus = Schema.Literals([
  'draft',
  'open',
  'paid',
  'uncollectible',
  'void',
]);
export type StripeInvoiceStatus = typeof StripeInvoiceStatus.Type;

const TaxTotal = Schema.Struct({
  amount: Minor,
  taxableAmount: Schema.NullOr(Minor),
}).pipe(Schema.encodeKeys({ taxableAmount: 'taxable_amount' }));

/**
 * A Stripe invoice as this application reads it. `clientSecret` is only
 * present when the request expanded `confirmation_secret`, which Stripe
 * fills once the invoice is finalized.
 */
export const StripeInvoice = Schema.Struct({
  id: StripeInvoiceId,
  status: StripeInvoiceStatus,
  currency: Schema.String,
  subtotal: Minor,
  total: Minor,
  amountRemaining: Minor,
  taxes: Schema.NullOr(Schema.Array(TaxTotal)),
  lines: Schema.Struct({ data: Schema.Array(Schema.Struct({})) }),
  metadata: Schema.Record(Schema.String, Schema.String),
  confirmationSecret: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({ clientSecret: Schema.String }).pipe(
        Schema.encodeKeys({ clientSecret: 'client_secret' }),
      ),
    ),
  ),
}).pipe(
  Schema.encodeKeys({
    amountRemaining: 'amount_remaining',
    taxes: 'total_taxes',
    confirmationSecret: 'confirmation_secret',
  }),
);
export interface StripeInvoice
  extends Schema.Schema.Type<typeof StripeInvoice> {}

export const PaymentIntentId = prefixed('pi').pipe(
  Schema.brand('PaymentIntentId'),
);
export type PaymentIntentId = typeof PaymentIntentId.Type;

/** A PaymentIntent, as far as the browser needs it to confirm one. */
export const StripeIntent = Schema.Struct({
  id: PaymentIntentId,
  clientSecret: Schema.String,
  status: Schema.String,
}).pipe(Schema.encodeKeys({ clientSecret: 'client_secret' }));
export interface StripeIntent extends Schema.Schema.Type<typeof StripeIntent> {}

/**
 * One payment applied to a Stripe invoice, settled or still in flight.
 * `amountPaid` is what it settled on this invoice, not necessarily the whole
 * PaymentIntent; `refunded` is what Stripe has given back of it since.
 * `intent` is the PaymentIntent behind it, absent for the invoice's own
 * default payment and for payments recorded out of band.
 */
export const StripeInvoicePayment = Schema.Struct({
  id: InvoicePaymentId,
  status: Schema.String,
  isDefault: Schema.Boolean,
  amountRequested: Minor,
  amountPaid: Schema.NullOr(Minor),
  paidAt: Schema.NullOr(Schema.Number),
  refunded: Minor,
  intent: Schema.NullOr(
    Schema.Struct({ id: PaymentIntentId, status: Schema.String }),
  ),
});
export interface StripeInvoicePayment
  extends Schema.Schema.Type<typeof StripeInvoicePayment> {}

/**
 * A verified webhook event, reduced to what names the invoice it concerns.
 * Settlement never trusts the rest of the payload: it reads the invoice back
 * from Stripe, so an old or reordered event cannot move the ledger backwards.
 */
export const StripeEvent = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  data: Schema.Struct({
    object: Schema.Struct({
      object: Schema.String,
      id: Schema.String,
      invoice: Schema.optionalKey(Schema.NullOr(Schema.String)),
      payment_intent: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  }),
});
export interface StripeEvent extends Schema.Schema.Type<typeof StripeEvent> {}

/** The Stripe invoice an event is about, if it is about one. */
export function invoiceOfEvent(event: StripeEvent): StripeInvoiceId | null {
  const { object } = event.data;
  const id =
    object.object === 'invoice'
      ? object.id
      : object.object === 'invoice_payment'
        ? object.invoice
        : null;
  return id && Schema.is(StripeInvoiceId)(id) ? id : null;
}

/**
 * The PaymentIntent a charge or refund event is about. Its invoice takes one
 * more lookup, since neither object names it.
 */
export function intentOfEvent(event: StripeEvent): PaymentIntentId | null {
  const { object } = event.data;
  const id =
    object.object === 'charge' || object.object === 'refund'
      ? object.payment_intent
      : null;
  return id && Schema.is(PaymentIntentId)(id) ? id : null;
}

/**
 * A Stripe call that did not produce a usable answer. `retryable` is true
 * only when repeating the same request, with the same idempotency key, is
 * safe and may succeed: dropped connections, rate limits, and Stripe's own
 * faults. `reason: 'response'` means Stripe answered with a shape this
 * application does not understand.
 */
export class StripeFailure extends Schema.TaggedError<StripeFailure>()(
  'StripeFailure',
  {
    operation: Schema.String,
    reason: Schema.Literals([
      'connection',
      'rate-limit',
      'api',
      'request',
      'authentication',
      'idempotency',
      'signature',
      'response',
    ]),
    message: Schema.String,
    status: Schema.NullOr(Schema.Number),
    requestId: Schema.NullOr(Schema.String),
    retryable: Schema.Boolean,
  },
) {}

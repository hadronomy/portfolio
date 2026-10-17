import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';
import Stripe from 'stripe';
import type { InvoiceId } from '#model';
import { call } from '#stripe/call';
import {
  InvoicePaymentId,
  Minor,
  PaymentIntentId,
  StripeCustomerId,
  type StripeFailure,
  StripeIntent,
  StripeInvoice,
  StripeInvoiceId,
  type StripeInvoicePayment,
} from '#stripe/schema';

/**
 * The Stripe calls invoice collection makes, each one decoded, classified,
 * and retried in one place. Mutations take an idempotency key: a retry, here
 * or after a crash, sends the same key with the same parameters, so Stripe
 * performs the action once.
 */
export interface StripeGatewayApi {
  /** Creates the customer, or brings an existing one in line with `details`. */
  readonly customer: (input: {
    readonly id: StripeCustomerId | null;
    readonly details: Stripe.CustomerCreateParams;
    readonly key: string;
  }) => Effect.Effect<StripeCustomerId, StripeFailure>;
  /** Creates an empty draft invoice. */
  readonly draft: (
    params: Stripe.InvoiceCreateParams,
    key: string,
  ) => Effect.Effect<StripeInvoice, StripeFailure>;
  /** Adds every line to a draft in one atomic request. */
  readonly addLines: (
    id: StripeInvoiceId,
    lines: readonly Stripe.InvoiceAddLinesParams.Line[],
    key: string,
  ) => Effect.Effect<StripeInvoice, StripeFailure>;
  /** Finalizes a draft, which creates the payment the customer confirms. */
  readonly finalize: (
    id: StripeInvoiceId,
    key: string,
  ) => Effect.Effect<StripeInvoice, StripeFailure>;
  /** Reads an invoice with its client secret, when it has one. */
  readonly read: (
    id: StripeInvoiceId,
  ) => Effect.Effect<StripeInvoice, StripeFailure>;
  /**
   * The live Stripe invoice made for a local one, found by its metadata.
   * Search lags writes by up to a minute, so this only recovers a draft
   * whose ID was lost, it never replaces the stored one.
   */
  readonly find: (
    invoice: InvoiceId,
  ) => Effect.Effect<StripeInvoice | null, StripeFailure>;
  /**
   * Every payment on the invoice, across all pages: settled ones with what
   * has been refunded of them, and attempts still open or canceled.
   */
  readonly payments: (
    id: StripeInvoiceId,
  ) => Effect.Effect<readonly StripeInvoicePayment[], StripeFailure>;
  /** Creates a PaymentIntent the browser confirms. */
  readonly intent: (
    params: Stripe.PaymentIntentCreateParams,
    key: string,
  ) => Effect.Effect<StripeIntent, StripeFailure>;
  /** Puts a PaymentIntent toward the invoice: what it settles, the invoice receives. */
  readonly attach: (
    id: StripeInvoiceId,
    intent: PaymentIntentId,
    key: string,
  ) => Effect.Effect<StripeInvoice, StripeFailure>;
  /** Cancels an attempt the customer left behind, so it can never also succeed. */
  readonly cancel: (
    intent: PaymentIntentId,
  ) => Effect.Effect<void, StripeFailure>;
  /** The invoice a PaymentIntent was attached to, if any. */
  readonly invoiceOf: (
    intent: PaymentIntentId,
  ) => Effect.Effect<StripeInvoiceId | null, StripeFailure>;
}

/** Stripe, as invoice collection uses it. */
export class StripeGateway extends Context.Service<
  StripeGateway,
  StripeGatewayApi
>()('StripeGateway') {}

/**
 * The API version every request and webhook payload is read in. It matches
 * the installed SDK's types; moving it is an SDK upgrade, not a setting.
 */
export const apiVersion =
  '2026-09-30.endive' as const satisfies typeof Stripe.API_VERSION;

const Customer = Schema.Struct({ id: StripeCustomerId });
const SearchResult = Schema.Struct({ data: Schema.Array(StripeInvoice) });

// An invoice payment as the API returns it with its PaymentIntent and charge
// expanded. A charge or intent left as a bare ID means the expansion did not
// reach it, so it carries no refund to read.
const ChargeWire = Schema.Union([
  Schema.String,
  Schema.Struct({ amount_refunded: Minor }),
]);
const InvoicePaymentWire = Schema.Struct({
  id: InvoicePaymentId,
  status: Schema.String,
  is_default: Schema.Boolean,
  amount_requested: Minor,
  amount_paid: Schema.NullOr(Minor),
  status_transitions: Schema.Struct({ paid_at: Schema.NullOr(Schema.Number) }),
  payment: Schema.Struct({
    payment_intent: Schema.optionalKey(
      Schema.Union([
        PaymentIntentId,
        Schema.Struct({
          id: PaymentIntentId,
          status: Schema.String,
          latest_charge: Schema.NullOr(ChargeWire),
        }),
      ]),
    ),
    charge: Schema.optionalKey(ChargeWire),
  }),
});
type InvoicePaymentWire = typeof InvoicePaymentWire.Type;

const refundOf = (charge: typeof ChargeWire.Type | null | undefined) =>
  charge && typeof charge !== 'string' ? charge.amount_refunded : 0;

function paymentOf(wire: InvoicePaymentWire): StripeInvoicePayment {
  const intent = wire.payment.payment_intent;
  return {
    id: wire.id,
    status: wire.status,
    isDefault: wire.is_default,
    amountRequested: wire.amount_requested,
    amountPaid: wire.amount_paid,
    paidAt: wire.status_transitions.paid_at,
    refunded: (refundOf(wire.payment.charge) ||
      (intent && typeof intent !== 'string'
        ? refundOf(intent.latest_charge)
        : 0)) as Minor,
    intent: !intent
      ? null
      : typeof intent === 'string'
        ? { id: intent, status: 'unknown' }
        : { id: intent.id, status: intent.status },
  };
}

const PaymentOwner = Schema.Struct({
  data: Schema.Array(Schema.Struct({ invoice: Schema.String })),
});

/** The gateway over one Stripe client. */
export function makeStripeGateway(stripe: Stripe): StripeGatewayApi {
  const secret = { expand: ['confirmation_secret'] };
  return {
    customer: ({ id, details, key }) =>
      call('customer', Customer, () =>
        id
          ? stripe.customers.update(id, details)
          : stripe.customers.create(details, { idempotencyKey: key }),
      ).pipe(Effect.map((customer) => customer.id)),
    draft: (params, key) =>
      call('draft', StripeInvoice, () =>
        stripe.invoices.create(params, { idempotencyKey: key }),
      ),
    addLines: (id, lines, key) =>
      call('addLines', StripeInvoice, () =>
        stripe.invoices.addLines(
          id,
          { lines: [...lines] },
          { idempotencyKey: key },
        ),
      ),
    finalize: (id, key) =>
      call('finalize', StripeInvoice, () =>
        stripe.invoices.finalizeInvoice(
          id,
          { auto_advance: false, ...secret },
          { idempotencyKey: key },
        ),
      ),
    read: (id) =>
      call('read', StripeInvoice, () => stripe.invoices.retrieve(id, secret)),
    find: (invoice) =>
      call('find', SearchResult, () =>
        stripe.invoices.search({
          query: `metadata['invoice']:'${invoice}'`,
        }),
      ).pipe(
        Effect.map(
          (result) =>
            result.data.find((found) => found.status !== 'void') ?? null,
        ),
      ),
    payments: (id) =>
      call('payments', Schema.Array(InvoicePaymentWire), () =>
        stripe.invoicePayments
          .list({
            invoice: id,
            limit: 100,
            expand: [
              'data.payment.payment_intent.latest_charge',
              'data.payment.charge',
            ],
          })
          .autoPagingToArray({ limit: 10_000 }),
      ).pipe(Effect.map((payments) => payments.map(paymentOf))),
    intent: (params, key) =>
      call('intent', StripeIntent, () =>
        stripe.paymentIntents.create(params, { idempotencyKey: key }),
      ),
    attach: (id, intent, key) =>
      call('attach', StripeInvoice, () =>
        stripe.invoices.attachPayment(
          id,
          { payment_intent: intent },
          { idempotencyKey: key },
        ),
      ),
    cancel: (intent) =>
      call('cancel', Schema.Struct({ id: PaymentIntentId }), () =>
        stripe.paymentIntents.cancel(intent),
      ).pipe(Effect.asVoid),
    invoiceOf: (intent) =>
      call('invoiceOf', PaymentOwner, () =>
        stripe.invoicePayments.list({
          payment: { type: 'payment_intent', payment_intent: intent },
          limit: 1,
        }),
      ).pipe(
        Effect.map(({ data }) => {
          const owner = data[0]?.invoice;
          return owner && Schema.is(StripeInvoiceId)(owner) ? owner : null;
        }),
      ),
  };
}

/** The Stripe secret key. It stays redacted until the client is built. */
export const StripeConfig = Config.Redacted('STRIPE_SECRET_KEY');

/** The gateway over the official SDK, configured from `StripeConfig`. */
export const stripeGatewayLayer = Layer.effect(
  StripeGateway,
  Effect.gen(function* () {
    const secretKey = yield* StripeConfig;
    const stripe = new Stripe(Redacted.value(secretKey), {
      apiVersion,
      maxNetworkRetries: 0,
      timeout: 20_000,
      httpClient: Stripe.createFetchHttpClient(),
      appInfo: { name: 'hadronomy-invoices' },
    });
    return StripeGateway.of(makeStripeGateway(stripe));
  }),
);

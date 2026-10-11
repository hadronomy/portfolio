import { settlementOf } from '@portfolio/invoices/settlement';
import { StripeWebhooks } from '@portfolio/invoices/stripe/webhooks';
import { Effect } from 'effect';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { Settlements } from './settlements';

// Stripe's way in. A delivery is verified against its raw body, reduced to
// the settlement it calls for, and queued; only then does Stripe hear 200.
// Every other answer makes Stripe deliver again, for up to three days, so
// the status codes are the contract:
//
//   200  queued, or verified and about nothing this app settles
//   400  not from Stripe: missing, forged, altered, or stale signature
//   500  signed by Stripe, but not an event this app can read
//   503  verified, but the queue did not take it; deliver again later

/** Where the Stripe webhook endpoint points, on the Worker's own URL. */
export const webhookPath = '/stripe/webhook';

/**
 * The Stripe events this endpoint subscribes to: everything that changes
 * what an invoice has been paid, or whether it can still be paid.
 */
export const webhookEvents = [
  'invoice.paid',
  'invoice_payment.paid',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'charge.refunded',
  'refund.updated',
] as const;

const receive = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const webhooks = yield* StripeWebhooks;
  const settlements = yield* Settlements;
  const payload = yield* request.text;
  const event = yield* webhooks.verify(
    payload,
    request.headers['stripe-signature'] ?? '',
  );
  const settlement = settlementOf(event);
  if (settlement) yield* settlements.enqueue([settlement]);
  return HttpServerResponse.empty({ status: 200 });
}).pipe(Effect.withSpan('Webhook.receive'));

/**
 * The answer to a failure the contract above names. A 5xx is the app's
 * fault, not the sender's, so it is logged with the failure behind it.
 */
const respond = (status: number, text: string) => (failure: unknown) =>
  Effect.as(
    status >= 500 ? Effect.logError(text, failure) : Effect.void,
    HttpServerResponse.text(text, { status }),
  );

/** The webhook endpoint, as a route on the Worker's router. */
export const webhookRoute = HttpRouter.add(
  'POST',
  webhookPath,
  receive.pipe(
    Effect.catchTags({
      InvalidSignature: respond(400, 'Invalid signature.'),
      HttpServerError: respond(400, 'Unreadable body.'),
      StripeFailure: respond(500, 'Not processed.'),
      QueueUnavailable: respond(503, 'Not queued; deliver again.'),
    }),
  ),
);

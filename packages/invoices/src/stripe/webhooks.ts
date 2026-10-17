import {
  Config,
  ConfigProvider,
  Context,
  Effect,
  Layer,
  Redacted,
  Schema,
} from 'effect';
import Stripe from 'stripe';
import { call } from '#stripe/call';
import { StripeEvent, type StripeFailure } from '#stripe/schema';

// Proof that a webhook delivery came from Stripe. It is its own capability,
// apart from the gateway: it needs the endpoint's signing secret and Web
// Crypto, never the API key, so it runs wherever deliveries land.

/** A delivery Stripe did not sign: forged, altered, stale, or missing its header. */
export class InvalidSignature extends Schema.TaggedError<InvalidSignature>()(
  'InvalidSignature',
  {},
) {}

export interface StripeWebhooksApi {
  /**
   * The event a delivery carries, once its `Stripe-Signature` header checks
   * out against the raw body. `payload` must be the body exactly as it
   * arrived: parsing and re-serialising it breaks the signature. A signed
   * delivery this app cannot read fails as a StripeFailure.
   */
  readonly verify: (
    payload: string,
    signature: string,
  ) => Effect.Effect<StripeEvent, InvalidSignature | StripeFailure>;
}

/** Verifies Stripe webhook deliveries. */
export class StripeWebhooks extends Context.Service<
  StripeWebhooks,
  StripeWebhooksApi
>()('StripeWebhooks') {}

/** The signing secret Stripe shows for the endpoint, `whsec_…`. */
export const StripeWebhookConfig = Config.Redacted('STRIPE_WEBHOOK_SECRET');

/**
 * Verification with Web Crypto, which every runtime here has: Node, Bun, and
 * workerd. Naming the provider keeps the SDK from choosing one by the
 * platform it thinks it is on.
 */
export const stripeWebhooksLayer = Layer.effect(
  StripeWebhooks,
  Effect.gen(function* () {
    // The secret is read per delivery, through the provider the layer was
    // built with. Alchemy builds the Worker at deploy time to learn its
    // bindings, before Stripe has minted the endpoint the secret belongs to.
    // A Worker without it is misdeployed, so a missing secret is a defect:
    // Stripe hears 500 and delivers again once it is bound.
    const provider = yield* ConfigProvider.ConfigProvider;
    const secret = StripeWebhookConfig.parse(provider).pipe(Effect.orDie);
    const crypto = Stripe.createSubtleCryptoProvider();
    return StripeWebhooks.of({
      verify: (payload, signature) =>
        Effect.flatMap(secret, (key) =>
          call('verify', StripeEvent, () =>
            Stripe.webhooks.constructEventAsync(
              payload,
              signature,
              Redacted.value(key),
              undefined,
              crypto,
            ),
          ),
        ).pipe(
          Effect.catchIf(
            (failure) => failure.reason === 'signature',
            () => Effect.fail(new InvalidSignature()),
          ),
        ),
    });
  }),
);

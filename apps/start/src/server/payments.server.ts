import {
  Collection,
  type CollectionApi,
  collectionLayer,
} from '@portfolio/invoices/collection';
import { stripeGatewayLayer } from '@portfolio/invoices/stripe/gateway';
import { Context, Effect, Layer, Option } from 'effect';
import { AppConfig } from './config.server';

// Online payment, when it is set up. Without Stripe keys the app works as
// before, invoices are paid by transfer, and every payment surface answers
// as if the feature did not exist; so the service is an Option, and each
// caller decides what "not set up" looks like on its page.

export interface PaymentsApi {
  readonly collection: CollectionApi;
  /** What the browser loads Stripe.js with. */
  readonly publishableKey: string;
}

/** Card payments through Stripe, or none. */
export class Payments extends Context.Service<
  Payments,
  Option.Option<PaymentsApi>
>()('Payments') {}

export const paymentsLayer = Layer.unwrap(
  Effect.gen(function* () {
    const { stripePublishableKey } = yield* AppConfig;
    if (!stripePublishableKey) return Layer.succeed(Payments, Option.none());
    return Layer.effect(
      Payments,
      Effect.map(Effect.service(Collection), (collection) =>
        Option.some({ collection, publishableKey: stripePublishableKey }),
      ),
    ).pipe(Layer.provide(collectionLayer), Layer.provide(stripeGatewayLayer));
  }),
);

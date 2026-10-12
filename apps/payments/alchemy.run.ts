import { apiVersion } from '@portfolio/invoices/stripe/gateway';
import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Output from 'alchemy/Output';
import * as Stripe from 'alchemy/Stripe';
import { Config, Effect, Layer } from 'effect';
import { FailedSettlementQueue } from './src/queue';
import { webhookEvents, webhookPath } from './src/webhook';
import PaymentsWorker from './src/worker';

// The payments stack: the Worker, its queues, its Hyperdrive, and the Stripe
// webhook endpoint that points at it. `bun run deploy` reads, from the
// environment:
//
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   where to deploy
//   STRIPE_API_KEY      creates the webhook endpoint (a restricted key with
//                       webhook endpoint write access is enough)
//   STRIPE_SECRET_KEY   what the Worker calls Stripe with
//   DATABASE_URL        the invoice database, already migrated
//   INVOICE_ORIGIN      the public web app origin for mail retries
//   INVOICE_MAIL_RETRY_SECRET   the web app's shared HMAC key
//
// `bun run dev` runs the Worker locally instead, against DATABASE_URL, which
// must be a database this machine reaches. Stripe cannot reach the Worker,
// so there is no endpoint: `stripe listen --forward-to
// localhost:1337/stripe/webhook` forwards deliveries and prints the
// STRIPE_WEBHOOK_SECRET to set.

export default Alchemy.Stack(
  'Payments',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Stripe.providers()),
    // Deploys keep state in Cloudflare, where CI and every machine share it;
    // `alchemy dev` keeps it on disk, so working locally creates nothing.
    state: Layer.unwrap(
      Alchemy.ALCHEMY_DEV.pipe(
        Effect.map((dev) => (dev ? Alchemy.localState() : Cloudflare.state())),
        Effect.orDie,
      ),
    ),
  },
  Effect.gen(function* () {
    yield* FailedSettlementQueue;
    const worker = yield* PaymentsWorker;
    // Locally `stripe listen` forwards deliveries and prints the signing
    // secret to set. Deployed, Stripe shows the secret once, when it makes
    // the endpoint; Alchemy keeps it in state and hands it to the Worker.
    const secret = (yield* Alchemy.ALCHEMY_DEV)
      ? yield* Config.Redacted('STRIPE_WEBHOOK_SECRET')
      : (yield* Stripe.WebhookEndpoint('Webhook', {
          url: Output.interpolate`${worker.url}${webhookPath}`,
          enabledEvents: [...webhookEvents],
          apiVersion,
          description: 'Invoice payments',
        })).secret;
    yield* worker.bind('stripe-webhook', {
      env: { STRIPE_WEBHOOK_SECRET: secret },
    });
    yield* worker.bind('mail-retry', {
      env: {
        INVOICE_ORIGIN: yield* Config.String('INVOICE_ORIGIN'),
        INVOICE_MAIL_RETRY_SECRET: yield* Config.Redacted(
          'INVOICE_MAIL_RETRY_SECRET',
        ),
      },
    });
    return { url: worker.url };
  }),
);

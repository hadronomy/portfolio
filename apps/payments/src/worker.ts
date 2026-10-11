import { Collection, collectionLayer } from '@portfolio/invoices/collection';
import { storeLayer } from '@portfolio/invoices/store';
import { stripeGatewayLayer } from '@portfolio/invoices/stripe/gateway';
import { stripeWebhooksLayer } from '@portfolio/invoices/stripe/webhooks';
import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import { Effect, Layer, Stream } from 'effect';
import { HttpRouter } from 'effect/http';
import { invoiceDatabase } from './database';
import { failedQueueName, queueLayer, SettlementQueue } from './queue';
import { decode, Settlements } from './settlements';
import { webhookRoute } from './webhook';

// The payments Worker: Stripe's side of invoice collection, off the web
// app's servers. Three ways in, one piece of work:
//
//   fetch      Stripe's webhook names a settlement and queues it.
//   schedule   every 15 minutes, every collection that can still change is
//              queued again, so a lost webhook costs minutes, not money.
//   queue      each settlement reads Stripe and brings the ledger in line.
//
// Construction runs once per isolate, and once at deploy time, where it is
// how Alchemy learns the bindings: it opens no connection and calls no API.

/** How often reconciliation runs. Cron Triggers keep UTC and whole minutes. */
const reconcileEvery = '*/15 * * * *';

export default class PaymentsWorker extends Cloudflare.Worker<PaymentsWorker>()(
  'Payments',
  {
    main: import.meta.url,
    // From 2026-08-04 Node compatibility is on by default; the invoice
    // modules use node:crypto for hashes.
    compatibility: { date: '2026-09-15' },
  },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;
    const queue = yield* SettlementQueue;
    const settlements = queueLayer(yield* Cloudflare.Queues.WriteQueue(queue));
    const collection = yield* Effect.service(Collection).pipe(
      Effect.provide(
        collectionLayer.pipe(
          Layer.provide(Layer.mergeAll(storeLayer, stripeGatewayLayer)),
          Layer.provide(yield* invoiceDatabase),
        ),
      ),
    );

    const consume = (body: unknown) =>
      decode(body).pipe(
        Effect.flatMap(collection.settle),
        // A message this Worker never wrote fails the same way every time:
        // acknowledge it, rather than retry it into the dead-letter queue.
        Effect.catchTag('SchemaError', () =>
          Effect.logWarning('Dropped a message that is not a settlement'),
        ),
        Effect.withSpan('Payments.consume'),
      );

    const reconcile = collection.unsettled().pipe(
      Effect.tap((pending) =>
        Settlements.use((queue) => queue.enqueue(pending)),
      ),
      Effect.tap((pending) =>
        Effect.logInfo('Reconciliation queued', { count: pending.length }),
      ),
      Effect.withSpan('Payments.reconcile'),
    );

    yield* Cloudflare.Queues.consumeQueueMessages(
      queue,
      {
        // One settlement per batch: a retry repeats only the one that failed.
        batchSize: 1,
        maxRetries: 10,
        retryDelay: '1 minute',
        deadLetterQueue: failedQueueName(stage),
      },
      (messages) =>
        Stream.runForEach(messages, (message) => consume(message.body)),
    );
    yield* Cloudflare.Workers.cron(reconcileEvery, () =>
      reconcile.pipe(
        Effect.provide(settlements),
        Effect.tapCause((cause) =>
          Effect.logError('Reconciliation failed', cause),
        ),
      ),
    );

    const router = yield* HttpRouter.toHttpEffect(
      // The signing secret is minted with the endpoint, after the Worker
      // exists, so it is read per request rather than at construction.
      webhookRoute.pipe(HttpRouter.provideRequest(stripeWebhooksLayer)),
    );
    // The queue binding resolves only inside an event.
    return { fetch: router.pipe(Effect.provide(settlements)) };
  }).pipe(
    Effect.provide([
      Cloudflare.Queues.WriteQueueBinding,
      Cloudflare.Queues.EventSourceLive,
      Cloudflare.Workers.CronEventSourceLive,
      Cloudflare.Hyperdrive.ConnectBinding,
    ]),
  ),
) {}

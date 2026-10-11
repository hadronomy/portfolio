import { Settlement } from '@portfolio/invoices/settlement';
import type { RuntimeContext } from 'alchemy';
import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import { Array as Arr, Effect, Layer, Schema } from 'effect';
import { QueueUnavailable, Settlements } from './settlements';

// The Cloudflare Queues behind Settlements.

/** Settlements waiting to run. */
export const SettlementQueue = Cloudflare.Queues.Queue('Settlements');

/**
 * The queue where settlements that failed every retry wait. Nothing consumes
 * it: each message is a payment someone has to look at. The consumer names
 * it by its physical name, so the name is fixed per stage.
 */
export const failedQueueName = (stage: string) =>
  `payments-${stage}-failed-settlements`;

/** The dead-letter queue itself, declared by the stack. */
export const FailedSettlementQueue = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  return yield* Cloudflare.Queues.Queue('FailedSettlements', {
    name: failedQueueName(stage),
  });
});

/** Cloudflare takes at most 100 messages in one batch send. */
const batch = 100;

const encode = Schema.encodeSync(Settlement);

/**
 * Settlements over a Cloudflare Queue producer binding. The binding only
 * resolves inside a Worker event, so provide this layer per event: it keeps
 * that event's runtime context for every send.
 */
export const queueLayer = (queue: Cloudflare.Queues.WriteQueueClient) =>
  Layer.effect(
    Settlements,
    Effect.gen(function* () {
      const event = yield* Effect.context<RuntimeContext>();
      return Settlements.of({
        enqueue: (settlements) =>
          Effect.forEach(
            Arr.chunksOf(settlements, batch),
            (group) =>
              queue.sendBatch(
                group.map((settlement) => ({ body: encode(settlement) })),
              ),
            { discard: true },
          ).pipe(
            Effect.provideContext(event),
            Effect.mapError(
              (error) => new QueueUnavailable({ message: String(error) }),
            ),
            Effect.withSpan('Settlements.enqueue'),
          ),
      });
    }),
  );

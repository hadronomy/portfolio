import { Settlement } from '@portfolio/invoices/settlement';
import { Context, type Effect, Schema } from 'effect';

// The durable hand-off between receiving work and doing it. A webhook
// delivery or a reconciliation pass only names a settlement and queues it;
// the queue's consumer settles it, with retries, and parks what keeps
// failing in a dead-letter queue. So Stripe gets its answer in milliseconds,
// and no crash between the two loses a payment. The Cloudflare queues behind
// it live in queue.ts.

/** The queue refused or dropped a send; the caller still holds the work. */
export class QueueUnavailable extends Schema.TaggedError<QueueUnavailable>()(
  'QueueUnavailable',
  { message: Schema.String },
) {}

export interface SettlementsApi {
  /**
   * Queues settlements. Once it succeeds they are stored and will run, at
   * least once each; a failure means none of the unsent ones were stored.
   */
  readonly enqueue: (
    settlements: readonly Settlement[],
  ) => Effect.Effect<void, QueueUnavailable>;
}

/** Where settlements go to wait for the consumer. */
export class Settlements extends Context.Service<Settlements, SettlementsApi>()(
  'Payments.Settlements',
) {}

/**
 * Reads one queued message back into a settlement. A message that is not
 * one was never sent by this Worker, so it is dropped, not retried.
 */
export const decode = Schema.decodeUnknownEffect(Settlement);

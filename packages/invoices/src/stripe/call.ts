import { Effect, Schedule, Schema } from 'effect';
import Stripe from 'stripe';
import { StripeFailure } from './schema';

// One way to make a Stripe call, shared by every service that talks to
// Stripe: classify what went wrong, retry only what Stripe says is safe to
// repeat, and decode the answer before anyone reads it.

const reasons: Record<string, StripeFailure['reason']> = {
  StripeConnectionError: 'connection',
  StripeRateLimitError: 'rate-limit',
  StripeAPIError: 'api',
  StripeInvalidRequestError: 'request',
  StripeCardError: 'request',
  StripeAuthenticationError: 'authentication',
  StripePermissionError: 'authentication',
  StripeIdempotencyError: 'idempotency',
  StripeSignatureVerificationError: 'signature',
};

/**
 * Stripe says outright whether a request is worth repeating in its
 * `Stripe-Should-Retry` header; without it, only faults that happened before
 * or inside Stripe, and never a refused request, are.
 */
export const classify = (operation: string) => (error: unknown) => {
  if (!(error instanceof Stripe.errors.StripeError))
    return new StripeFailure({
      operation,
      reason: 'api',
      message: error instanceof Error ? error.message : String(error),
      status: null,
      requestId: null,
      retryable: false,
    });
  const reason = reasons[error.type] ?? 'api';
  const advice = error.headers?.['stripe-should-retry'];
  return new StripeFailure({
    operation,
    reason,
    message: error.message,
    status: error.statusCode ?? null,
    requestId: error.requestId ?? null,
    retryable:
      advice === 'true' ||
      (advice !== 'false' &&
        (reason === 'connection' ||
          reason === 'rate-limit' ||
          (reason === 'api' && (error.statusCode ?? 500) >= 500))),
  });
};

// The SDK's own retries are off, so this is the only retry loop: three more
// attempts, backing off from a quarter second, with jitter so that parallel
// requests do not come back in step.
const retry = {
  schedule: Schedule.exponential('250 millis').pipe(Schedule.jittered),
  times: 3,
  while: (failure: StripeFailure) => failure.retryable,
};

/**
 * Runs a Stripe request as an Effect: retried while the failure is
 * retryable, decoded with `schema`, and traced as `Stripe.<operation>`.
 */
export function call<S extends Schema.Constraint>(
  operation: string,
  schema: S,
  request: () => Promise<unknown>,
): Effect.Effect<S['Type'], StripeFailure, S['DecodingServices']> {
  const decode = Schema.decodeUnknownEffect(schema);
  return Effect.tryPromise({ try: request, catch: classify(operation) }).pipe(
    Effect.retry(retry),
    Effect.flatMap((response) =>
      decode(response).pipe(
        Effect.mapError(
          (issue) =>
            new StripeFailure({
              operation,
              reason: 'response',
              message: issue.message,
              status: null,
              requestId: null,
              retryable: false,
            }),
        ),
      ),
    ),
    Effect.withSpan(`Stripe.${operation}`),
  );
}

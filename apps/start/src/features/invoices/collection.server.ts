import type { CollectionError } from '@portfolio/invoices/collection';
import {
  type AttemptId,
  type CollectionStatus,
  PayFailure,
} from '@portfolio/invoices/collection-model';
import { CustomerAccess } from '@portfolio/invoices/customer-access';
import type {
  InvoiceId,
  Language,
  OwnerDid,
  RecordId,
} from '@portfolio/invoices/model';
import { Effect, Match, Option } from 'effect';
import {
  pdfResponse,
  unavailable,
} from '~/features/invoices/operations.server';
import { requireOwner, viewer } from '~/server/auth.server';
import { Payments, type PaymentsApi } from '~/server/payments.server';
import { origin, Refused, sameOrigin } from '~/server/request.server';

// The request side of online payments. Each effect authorizes its caller,
// runs one Collection operation, and turns the result into something a
// server function or a route can return. Without Stripe configured, every
// one answers as if the feature did not exist.

/**
 * Who asks to see or pay an invoice: whoever holds a payment link, or a
 * signed-in customer the invoice is billed to. Each is checked on every
 * request, and opens one invoice and nothing else in the workspace.
 */
export type Access =
  | { readonly _tag: 'Link'; readonly token: string }
  | { readonly _tag: 'Account'; readonly id: InvoiceId };

const unconfigured = { _tag: 'Unconfigured' } as const;

/** Runs `use` with online payments, or answers `off` when they are not set up. */
const withPayments = <A, B, E, R>(
  off: B,
  use: (payments: PaymentsApi) => Effect.Effect<A, E, R>,
): Effect.Effect<A | B, E, R | Payments> =>
  Effect.flatMap(
    Effect.service(Payments),
    (payments): Effect.Effect<A | B, E, R> =>
      Option.isSome(payments) ? use(payments.value) : Effect.succeed(off),
  );

/** The invoice a link opens, while it opens. */
const byLink = (payments: PaymentsApi, token: string) =>
  payments.collection.resolve(token).pipe(
    Effect.map(Option.some),
    Effect.catchTag('LinkInvalid', () => Effect.succeedNone),
    unavailable,
  );

/** The invoice, if the signed-in customer is the one it is billed to. */
const byAccount = Effect.fn('Payments.byAccount')(function* (id: InvoiceId) {
  const current = yield* viewer;
  if (current?._tag !== 'Customer') return Option.none<InvoiceId>();
  return yield* CustomerAccess.use((customers) =>
    customers.invoice(current.email, id),
  ).pipe(
    Effect.as(Option.some(id)),
    Effect.catchTag('MissingInvoice', () => Effect.succeedNone),
    unavailable,
  );
});

/** The invoice `access` opens, or none. */
const authorize = (access: Access) =>
  withPayments(Option.none<InvoiceId>(), (payments) =>
    access._tag === 'Link'
      ? byLink(payments, access.token)
      : byAccount(access.id),
  ).pipe(Effect.withSpan('Payments.authorize'));

/** Where an invoice's collection stands, or that online payments are off. */
export const linkStatus = (id: InvoiceId) =>
  withPayments(unconfigured, ({ collection }) =>
    unavailable<CollectionStatus, never>(collection.status(id)),
  );

/** The owner's view of where an invoice's collection stands. */
export const collectionStatus = Effect.fn('Payments.status')(function* (
  id: InvoiceId,
) {
  yield* requireOwner;
  return yield* linkStatus(id);
});

/** Why sharing failed, in terms the owner's interface can phrase. */
export type ShareFailure =
  | { readonly _tag: 'Unconfigured' }
  | { readonly _tag: 'NotCollectible'; readonly reason: string }
  | { readonly _tag: 'Mismatch' }
  | { readonly _tag: 'Stripe'; readonly reason: string }
  | { readonly _tag: 'Storage' };

const storage = () => ({ _tag: 'Storage' }) as const;

const shareFailure = Match.typeTags<CollectionError, ShareFailure>()({
  NotCollectible: ({ reason }) => ({ _tag: 'NotCollectible', reason }),
  ProjectionMismatch: () => ({ _tag: 'Mismatch' }),
  StripeFailure: ({ reason }) => ({ _tag: 'Stripe', reason }),
  InvalidInvoice: storage,
  MissingInvoice: storage,
  RevisionConflict: storage,
  StorageFailure: storage,
});

/** Puts the invoice up for payment and returns a new link to send. */
export const shareLink = Effect.fn('Payments.shareLink')(function* (
  id: InvoiceId,
  actor: OwnerDid,
  base: string,
) {
  return yield* withPayments(
    { ok: false as const, failure: unconfigured },
    ({ collection }) =>
      collection.share(id, actor).pipe(
        Effect.tapCause((cause) => Effect.logError('Sharing failed', cause)),
        Effect.match({
          onSuccess: ({ token, status }) => ({
            ok: true as const,
            url: `${base}/invoices/pay/${token}`,
            status,
          }),
          onFailure: (error) => ({
            ok: false as const,
            failure: shareFailure(error),
          }),
        }),
      ),
  );
});

/** Closes every open link to the invoice; the customer's page stops opening. */
/** The owner's request to share: from the invoice pages only. */
export const share = Effect.fn('Payments.share')(function* (id: InvoiceId) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  return yield* shareLink(id, actor, yield* origin);
});

/** Closes every open payment link to the invoice; how many it closed. */
export const revokeLinks = (id: InvoiceId, actor: OwnerDid) =>
  withPayments(0, ({ collection }) =>
    unavailable(collection.revoke(id, actor)),
  );

export const revoke = Effect.fn('Payments.revoke')(function* (id: InvoiceId) {
  yield* sameOrigin;
  return yield* revokeLinks(id, yield* requireOwner);
});

const paymentDown = () =>
  new Refused({
    status: 503,
    message: 'Payment is unavailable right now. Try again shortly.',
  });

/** The customer's page for the invoice `access` opens, or null when it opens none. */
export const checkout = Effect.fn('Payments.checkout')(function* (
  access: Access,
) {
  const id = yield* authorize(access);
  if (Option.isNone(id)) return null;
  return yield* withPayments(null, ({ collection, publishableKey }) =>
    collection.checkout(id.value).pipe(
      Effect.tapCause((cause) => Effect.logError('Checkout failed', cause)),
      Effect.mapError(paymentDown),
      Effect.map((page) => ({ page, publishableKey })),
    ),
  );
});

/**
 * Starts the customer's payment and returns the secret to confirm it with,
 * or why it could not start. Access that stopped opening reads as a changed
 * invoice: the page reloads into whatever is true now.
 */
export const startPayment = Effect.fn('Payments.start')(function* (request: {
  readonly access: Access;
  readonly amount: string;
  readonly attempt: AttemptId;
  readonly plan: RecordId;
}) {
  yield* sameOrigin;
  const changed = {
    ok: false as const,
    failure: PayFailure.cases.Changed.make({}),
  };
  const id = yield* authorize(request.access);
  if (Option.isNone(id)) return changed;
  return yield* withPayments(changed, ({ collection }) =>
    collection
      .pay(id.value, {
        amount: request.amount,
        attempt: request.attempt,
        plan: request.plan,
      })
      .pipe(
        Effect.tapCause((cause) => Effect.logError('Payment failed', cause)),
        Effect.match({
          onSuccess: ({ clientSecret }) => ({
            ok: true as const,
            clientSecret,
          }),
          onFailure: (error) => ({
            ok: false as const,
            failure:
              error._tag === 'PaymentRefused'
                ? error.failure
                : PayFailure.cases.Unreachable.make({}),
          }),
        }),
      ),
  );
});

/** The PDF a payment link points to: the same bytes the owner downloads. */
export const checkoutPdf = Effect.fn('Payments.pdf')(function* (
  token: string,
  language: Language,
) {
  const id = yield* authorize({ _tag: 'Link', token });
  if (Option.isNone(id))
    return yield* new Refused({ status: 404, message: 'Not found.' });
  return yield* pdfResponse(id.value, language);
});

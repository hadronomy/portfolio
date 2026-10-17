import { and, asc, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { InvoiceDatabase } from '#database';
import { type InvoiceId, type OwnerDid, StorageFailure } from '#model';
import {
  type MailDelivery,
  type MailKind,
  MailPayload,
  PreparedMail,
} from '#outbox-model';
import { decodeStored, stored } from '#storage';
import * as tables from '#tables';

type Transaction = Parameters<
  Parameters<InvoiceDatabase['Service']['transaction']>[0]
>[0];
export type OutboxRow = typeof tables.outbox.$inferSelect;
export interface ClaimedMail extends OutboxRow {
  readonly payload: MailPayload;
  readonly prepared: PreparedMail | null;
  readonly claimToken: string;
}

export class MailRetryRefused extends Schema.TaggedError<MailRetryRefused>()(
  'MailRetryRefused',
  { message: Schema.String },
) {}

/** Stop before Resend forgets its key. A lost response can mean the email went out. */
export const idempotencyWindow = 23 * 60 * 60 * 1000;
const lease = 2 * 60 * 1000;
const backoff = [60, 300, 900, 1800, 3600, 7200, 14400, 28800];
const decodePayload = decodeStored(MailPayload);
const decodePrepared = decodeStored(PreparedMail);

export interface EnqueueMail {
  readonly invoiceId: InvoiceId | null;
  readonly kind: MailKind;
  readonly recipient: string;
  readonly payload: MailPayload;
  readonly key: string;
  readonly expiresAt?: string;
}

/** Call with the transaction that records the business change. No provider request runs in that transaction. */
export const enqueueMail = (
  tx: Transaction,
  messages: readonly EnqueueMail[],
) => {
  const now = new Date().toISOString();
  return messages.length
    ? tx
        .insert(tables.outbox)
        .values(
          messages.map((message) => ({
            id: crypto.randomUUID(),
            invoiceId: message.invoiceId,
            kind: message.kind,
            recipient: message.recipient,
            payload: message.payload,
            state: 'pending' as const,
            idempotencyKey: message.key,
            expiresAt: message.expiresAt ?? null,
            nextAttemptAt: now,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: tables.outbox.id, kind: tables.outbox.kind })
    : Effect.succeed([]);
};

export const deliveryOf = (row: OutboxRow): MailDelivery => ({
  id: row.id,
  invoiceId: row.invoiceId as InvoiceId | null,
  kind: row.kind,
  recipient: row.recipient,
  state: row.state,
  attempts: row.attempts,
  nextAttemptAt: row.nextAttemptAt,
  lastError: row.lastError,
  messageId: row.messageId,
  createdAt: row.createdAt,
  sentAt: row.sentAt,
});

export interface OutboxApi {
  readonly enqueue: (
    messages: readonly EnqueueMail[],
  ) => Effect.Effect<void, StorageFailure>;
  readonly deliveries: (
    id: InvoiceId,
  ) => Effect.Effect<readonly MailDelivery[], StorageFailure>;
  readonly read: (
    id: string,
  ) => Effect.Effect<MailDelivery | null, StorageFailure>;
  readonly byKey: (
    key: string,
  ) => Effect.Effect<MailDelivery | null, StorageFailure>;
  readonly claim: (
    id?: string,
  ) => Effect.Effect<ClaimedMail | null, StorageFailure>;
  readonly prepare: (
    mail: ClaimedMail,
    body: PreparedMail,
  ) => Effect.Effect<boolean, StorageFailure>;
  readonly sending: (
    mail: ClaimedMail,
  ) => Effect.Effect<boolean, StorageFailure>;
  readonly sent: (
    mail: ClaimedMail,
    messageId: string,
  ) => Effect.Effect<void, StorageFailure>;
  readonly failed: (
    mail: ClaimedMail,
    message: string,
    permanent: boolean,
    uncertain: boolean,
  ) => Effect.Effect<void, StorageFailure>;
  readonly retry: (
    id: InvoiceId,
    email: string,
    actor: OwnerDid,
  ) => Effect.Effect<MailDelivery, StorageFailure | MailRetryRefused>;
}
export class Outbox extends Context.Service<Outbox, OutboxApi>()('Outbox') {}

export const outboxLayer = Layer.effect(
  Outbox,
  Effect.gen(function* () {
    const db = yield* InvoiceDatabase;
    const fenced = (mail: ClaimedMail) =>
      and(
        eq(tables.outbox.id, mail.id),
        eq(tables.outbox.claimToken, mail.claimToken),
      );
    const read = Effect.fn('Outbox.read')(function* (id: string) {
      const row = yield* stored(db.query.outbox.findFirst({ where: { id } }));
      return row ? deliveryOf(row) : null;
    });
    return Outbox.of({
      enqueue: Effect.fn('Outbox.enqueue')((messages) =>
        stored(db.transaction((tx) => enqueueMail(tx, messages))).pipe(
          Effect.asVoid,
        ),
      ),
      deliveries: Effect.fn('Outbox.deliveries')((id) =>
        stored(
          db
            .select()
            .from(tables.outbox)
            .where(eq(tables.outbox.invoiceId, id))
            .orderBy(desc(tables.outbox.createdAt)),
        ).pipe(Effect.map((rows) => rows.map(deliveryOf))),
      ),
      read,
      byKey: Effect.fn('Outbox.byKey')(function* (idempotencyKey) {
        const row = yield* stored(
          db.query.outbox.findFirst({ where: { idempotencyKey } }),
        );
        return row ? deliveryOf(row) : null;
      }),
      claim: Effect.fn('Outbox.claim')(function* (id) {
        const now = new Date();
        const row = yield* stored(
          db.transaction((tx) =>
            Effect.gen(function* () {
              const [found] = yield* tx
                .select()
                .from(tables.outbox)
                .where(
                  and(
                    eq(tables.outbox.state, 'pending'),
                    lte(tables.outbox.nextAttemptAt, now.toISOString()),
                    or(
                      isNull(tables.outbox.lockedUntil),
                      lte(tables.outbox.lockedUntil, now.toISOString()),
                    ),
                    id ? eq(tables.outbox.id, id) : undefined,
                  ),
                )
                .orderBy(asc(tables.outbox.nextAttemptAt))
                .limit(1)
                .for('update', { skipLocked: true });
              if (!found) return null;
              const [claimed] = yield* tx
                .update(tables.outbox)
                .set({
                  claimToken: crypto.randomUUID(),
                  lockedUntil: new Date(now.getTime() + lease).toISOString(),
                  attempts: found.attempts + 1,
                })
                .where(eq(tables.outbox.id, found.id))
                .returning();
              return claimed ?? null;
            }),
          ),
        );
        if (!row || !row.claimToken) return null;
        return {
          ...row,
          payload: yield* decodePayload(row.payload),
          prepared: row.prepared ? yield* decodePrepared(row.prepared) : null,
          claimToken: row.claimToken,
        };
      }),
      prepare: Effect.fn('Outbox.prepare')((mail, body) =>
        stored(
          db
            .update(tables.outbox)
            .set({ prepared: body })
            .where(
              and(
                fenced(mail),
                gt(tables.outbox.lockedUntil, new Date().toISOString()),
              ),
            )
            .returning({ id: tables.outbox.id }),
        ).pipe(Effect.map((rows) => rows.length > 0)),
      ),
      sending: Effect.fn('Outbox.sending')((mail) =>
        stored(
          db
            .update(tables.outbox)
            .set({
              uncertain: true,
              firstAttemptAt: mail.firstAttemptAt ?? new Date().toISOString(),
            })
            .where(
              and(
                fenced(mail),
                gt(tables.outbox.lockedUntil, new Date().toISOString()),
              ),
            )
            .returning({ id: tables.outbox.id }),
        ).pipe(Effect.map((rows) => rows.length > 0)),
      ),
      sent: Effect.fn('Outbox.sent')(function* (mail, messageId) {
        yield* stored(
          db.transaction((tx) =>
            Effect.gen(function* () {
              const now = new Date().toISOString();
              const rows = yield* tx
                .update(tables.outbox)
                .set({
                  state: 'sent',
                  messageId,
                  sentAt: now,
                  lastError: null,
                  uncertain: false,
                  lockedUntil: null,
                  claimToken: null,
                  prepared: null,
                  ...(mail.kind === 'sign-in-code'
                    ? {
                        payload: {
                          _tag: 'Code',
                          code: '',
                          language: 'en',
                          accountUrl: '',
                        },
                      }
                    : {}),
                })
                .where(fenced(mail))
                .returning();
              if (!rows.length || !mail.invoiceId) return;
              if (mail.kind === 'quote-answer')
                yield* tx
                  .update(tables.responses)
                  .set({ confirmedAt: now })
                  .where(eq(tables.responses.quoteId, mail.invoiceId));
              if (
                mail.kind === 'quote-invitation' &&
                mail.payload._tag === 'Invitation'
              )
                yield* tx.insert(tables.audit).values({
                  id: crypto.randomUUID(),
                  invoiceId: mail.invoiceId,
                  operation: 'quote-emailed',
                  actor: mail.payload.actor,
                  payload: {
                    to: mail.recipient,
                    sentAt: now,
                    expiresAt: mail.payload.expiresAt,
                  },
                  createdAt: now,
                });
            }),
          ),
        );
      }),
      failed: Effect.fn('Outbox.failed')(
        (mail, message, permanent, uncertain) => {
          const finished = permanent || mail.attempts >= backoff.length;
          return stored(
            db
              .update(tables.outbox)
              .set({
                state: finished ? 'failed' : 'pending',
                lastError: message,
                uncertain: mail.uncertain || uncertain,
                claimToken: null,
                lockedUntil: null,
                nextAttemptAt: new Date(
                  Date.now() +
                    (backoff[Math.min(mail.attempts - 1, backoff.length - 1)] ??
                      60) *
                      1000,
                ).toISOString(),
                ...(mail.kind === 'sign-in-code' && finished
                  ? {
                      prepared: null,
                      payload: {
                        _tag: 'Code',
                        code: '',
                        language: 'en',
                        accountUrl: '',
                      },
                    }
                  : {}),
              })
              .where(fenced(mail)),
          ).pipe(Effect.asVoid);
        },
      ),
      retry: Effect.fn('Outbox.retry')(function* (id, email, actor) {
        return yield* stored(
          db.transaction((tx) =>
            Effect.gen(function* () {
              const [row] = yield* tx
                .select()
                .from(tables.outbox)
                .where(
                  and(
                    eq(tables.outbox.id, email),
                    eq(tables.outbox.invoiceId, id),
                  ),
                )
                .for('update');
              const refused = (message: string) =>
                new MailRetryRefused({ message });
              if (!row)
                return yield* refused(
                  'No such email for this document. Read delivery state with get_document.',
                );
              if (row.state === 'sent') return deliveryOf(row);
              const now = Date.now();
              if (row.lockedUntil && Date.parse(row.lockedUntil) > now)
                return yield* refused(
                  'This email is being sent. Read its delivery state shortly.',
                );
              if (row.expiresAt && Date.parse(row.expiresAt) <= now)
                return yield* refused(
                  'This email has expired. Send a new invitation or request a new sign-in code.',
                );
              const expired =
                row.firstAttemptAt &&
                now - Date.parse(row.firstAttemptAt) >= idempotencyWindow;
              if (expired && row.uncertain)
                return yield* refused(
                  'Delivery is uncertain and its idempotency key has expired. Check Resend before sending a new email.',
                );
              const [next] = yield* tx
                .update(tables.outbox)
                .set({
                  state: 'pending',
                  nextAttemptAt: new Date(now).toISOString(),
                  ...(expired ? { firstAttemptAt: null } : {}),
                })
                .where(eq(tables.outbox.id, email))
                .returning();
              yield* tx.insert(tables.audit).values({
                id: crypto.randomUUID(),
                invoiceId: id,
                operation: 'email-retried',
                actor,
                payload: { email },
                createdAt: new Date(now).toISOString(),
              });
              if (!next)
                return yield* new StorageFailure({
                  message: 'The email could not be queued.',
                });
              return deliveryOf(next);
            }),
          ),
        );
      }),
    });
  }),
);

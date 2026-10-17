import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { InvoiceDatabase } from '#database';
import { InvoiceId, type OwnerDid } from '#model';
import { stored } from '#storage';
import * as tables from '#tables';

// Links that open one document for its customer: a payment link for an
// invoice, an acceptance link for a quote. The kind of document decides
// which page a link opens; the link itself only proves who may see it.
// The link table stores each token's SHA-256 hash.

/** A link's opaque token, as the customer's URL carries it. */
export const LinkToken = Schema.String.check(
  Schema.isPattern(/^[\w-]{43}$/),
).pipe(Schema.brand('LinkToken'));
export type LinkToken = typeof LinkToken.Type;

/** A token that is malformed, unknown, expired, or revoked. */
export class LinkInvalid extends Schema.TaggedError<LinkInvalid>()(
  'LinkInvalid',
  {},
) {}

/** How long a link opens. */
export const linkLifetime = 30 * 86_400_000;

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

type Database = InvoiceDatabase['Service'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Inserts the link and audit entry into the caller's transaction. */
export const createLink = Effect.fnUntraced(function* (
  tx: Transaction,
  id: InvoiceId,
  actor: OwnerDid,
  operation: string,
) {
  const token = LinkToken.make(randomBytes(32).toString('base64url'));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + linkLifetime).toISOString();
  yield* tx.insert(tables.links).values({
    tokenHash: hash(token),
    invoiceId: id,
    expiresAt,
    createdAt: now.toISOString(),
  });
  yield* tx.insert(tables.audit).values({
    id: crypto.randomUUID(),
    invoiceId: id,
    operation,
    actor,
    payload: { expiresAt },
    createdAt: now.toISOString(),
  });
  return { token, expiresAt };
});

/** Mints a link to the document and records who made it as `operation`. */
export const mintLink = Effect.fnUntraced(function* (
  db: Database,
  id: InvoiceId,
  actor: OwnerDid,
  operation: string,
) {
  return yield* stored(
    db.transaction((tx) => createLink(tx, id, actor, operation)),
  );
});

/** Closes every open link to the document and returns how many there were. */
export const revokeLinks = Effect.fnUntraced(function* (
  db: Database,
  id: InvoiceId,
  actor: OwnerDid,
  operation: string,
) {
  const now = new Date().toISOString();
  return yield* stored(
    db.transaction((tx) =>
      Effect.gen(function* () {
        const closed = yield* tx
          .update(tables.links)
          .set({ revokedAt: now })
          .where(
            and(
              eq(tables.links.invoiceId, id),
              isNull(tables.links.revokedAt),
              gt(tables.links.expiresAt, now),
            ),
          )
          .returning();
        if (closed.length)
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation,
            actor,
            payload: { count: closed.length },
            createdAt: now,
          });
        return closed.length;
      }),
    ),
  );
});

/** The document a link opens, while it is valid. */
export const resolveLink = Effect.fnUntraced(function* (
  db: Database,
  token: string,
) {
  if (!Schema.is(LinkToken)(token)) return yield* new LinkInvalid();
  const [link] = yield* stored(
    db
      .select({ invoiceId: tables.links.invoiceId })
      .from(tables.links)
      .where(
        and(
          eq(tables.links.tokenHash, hash(token)),
          isNull(tables.links.revokedAt),
          gt(tables.links.expiresAt, new Date().toISOString()),
        ),
      ),
  );
  if (!link) return yield* new LinkInvalid();
  return InvoiceId.make(link.invoiceId);
});

/** How many links to the document are open now. */
export const openLinks = Effect.fnUntraced(function* (
  db: Database,
  id: InvoiceId,
) {
  const rows = yield* stored(
    db
      .select({ tokenHash: tables.links.tokenHash })
      .from(tables.links)
      .where(
        and(
          eq(tables.links.invoiceId, id),
          isNull(tables.links.revokedAt),
          gt(tables.links.expiresAt, new Date().toISOString()),
        ),
      ),
  );
  return rows.length;
});

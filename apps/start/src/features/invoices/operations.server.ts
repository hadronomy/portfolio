import { createHash } from 'node:crypto';
import {
  InvalidInvoice,
  type Invoice,
  InvoiceId,
  type Language,
  MissingInvoice,
  RevisionConflict,
  StorageFailure,
} from '@portfolio/invoices/model';
import { renderInvoice } from '@portfolio/invoices/pdf';
import { artifacts } from '@portfolio/invoices/tables';
import { eq } from 'drizzle-orm';
import { Effect, Result, Schema } from 'effect';
import type { Mutation } from './api';
import { requireOwner, requireSameOrigin } from './auth.server';
import { runtime } from './runtime.server';

type MutationError =
  | InvalidInvoice
  | MissingInvoice
  | RevisionConflict
  | StorageFailure;

const asVoid = <A, E>(self: Effect.Effect<A, E>): Effect.Effect<void, E> =>
  self.pipe(Effect.asVoid);

const toMutationError = (error: unknown): MutationError =>
  error instanceof InvalidInvoice ||
  error instanceof MissingInvoice ||
  error instanceof RevisionConflict
    ? error
    : new StorageFailure({ message: 'The database operation failed.' });

const normalize = <A, E>(
  self: Effect.Effect<A, E>,
): Effect.Effect<A, MutationError> =>
  self.pipe(
    Effect.catch((error) => Effect.fail(toMutationError(error))),
    Effect.catchDefect(() =>
      Effect.fail(
        new StorageFailure({ message: 'The invoice store is unavailable.' }),
      ),
    ),
  );

const missingAs404 = (error: unknown): never => {
  if (error instanceof MissingInvoice)
    throw new Response('Invoice not found.', { status: 404 });
  throw error;
};

/** Loads the full workspace for the owner. */
export async function workspace() {
  await requireOwner();
  const run = Effect.fn('store.workspace')(function* () {
    return yield* (yield* Effect.promise(() => runtime())).store.workspace();
  });
  return Effect.runPromise(normalize(run()));
}

/** Applies one workspace edit for the owner, then returns the refreshed workspace or a recoverable tagged failure. */
export async function mutate(input: Mutation) {
  requireSameOrigin();
  const actor = await requireOwner();
  const run = Effect.fn('store.mutate')(function* () {
    const { store } = yield* Effect.promise(() => runtime());
    const operation = (() => {
      switch (input.action) {
        case 'save':
          return asVoid(store.save(input.invoice, actor));
        case 'issue':
          return asVoid(store.issue(input, actor));
        case 'remove':
          return store.remove(input.id, actor);
        case 'rectify':
          return asVoid(store.rectify(input.id, actor));
        case 'customer':
          return asVoid(store.customer(input.customer));
        case 'item':
          return asVoid(store.item(input.item));
        case 'preferences':
          return asVoid(store.preferences(input.preferences));
        case 'forget':
          return store.forget(input.kind, input.id);
        case 'payment':
          return asVoid(store.payment(input.payment, actor));
        case 'reverse-payment':
          return store.reversePayment(input.id, actor);
        default:
          return input satisfies never;
      }
    })();
    yield* operation;
    return yield* store.workspace();
  });
  return Effect.runPromise(
    normalize(run()).pipe(
      Effect.match({
        onSuccess: (result) => ({ ok: true as const, workspace: result }),
        onFailure: (error) => ({
          ok: false as const,
          error: error._tag,
          issues: error._tag === 'InvalidInvoice' ? error.issues : [],
          current: error._tag === 'RevisionConflict' ? error.current : null,
        }),
      }),
    ),
  );
}

/** Renders a draft preview without storing it, re-reading issued documents from the store so caller claims never change their numbers. */
export async function preview(invoice: Invoice) {
  requireSameOrigin();
  await requireOwner();
  const run = Effect.fn('store.preview')(function* () {
    const { store, database } = yield* Effect.promise(() => runtime());
    // Preview never accepts a caller's claim that a document is already issued.
    const document =
      invoice.status === 'issued'
        ? yield* store.read(invoice.id)
        : { ...invoice, number: null, issuedAt: null };
    if (document.status === 'issued') {
      // Issued previews come from the stored artifact when one exists, so the
      // preview matches the download byte for byte.
      const key = `${document.id}:${document.revision}:${invoice.data.language}`;
      const [existing] = yield* Effect.promise(async () =>
        database.db.select().from(artifacts).where(eq(artifacts.key, key)),
      );
      if (existing)
        return Buffer.from(existing.bytes, 'base64').toString('base64');
    }
    return yield* Effect.promise(() =>
      renderInvoice(document, invoice.data.language),
    ).pipe(Effect.map((bytes) => Buffer.from(bytes).toString('base64')));
  });
  return Effect.runPromise(normalize(run())).catch(missingAs404);
}

/** Serves the stored PDF for one invoice, failing with 404 when the invoice is unknown instead of fabricating bytes. */
export async function download(id: InvoiceId, language: Language) {
  await requireOwner();
  const decoded = Schema.decodeUnknownResult(InvoiceId)(id);
  if (Result.isFailure(decoded))
    throw new Response('Invoice not found.', { status: 404 });
  const run = Effect.fn('store.download')(function* () {
    const { store, database } = yield* Effect.promise(() => runtime());
    const invoice = yield* store.read(decoded.success);
    const key = `${decoded.success}:${invoice.revision}:${language}`;
    const [existing] = yield* Effect.promise(async () =>
      database.db.select().from(artifacts).where(eq(artifacts.key, key)),
    );
    if (existing)
      return { invoice, bytes: Buffer.from(existing.bytes, 'base64') };
    // The store row is the only source of numbers: render it directly and cache the bytes for issued invoices.
    const bytes = Buffer.from(
      yield* Effect.promise(() => renderInvoice(invoice, language)),
    );
    if (invoice.status === 'issued') {
      const row = {
        key,
        invoiceId: decoded.success,
        language,
        bytes: bytes.toString('base64'),
        digest: createHash('sha256').update(bytes).digest('hex'),
        createdAt: new Date().toISOString(),
      };
      yield* Effect.promise(async () => {
        await database.db.insert(artifacts).values(row).onConflictDoNothing();
      });
    }
    return { invoice, bytes };
  });
  const { invoice, bytes } = await Effect.runPromise(normalize(run())).catch(
    missingAs404,
  );
  const name = invoice.number ?? 'draft';
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}-${language}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

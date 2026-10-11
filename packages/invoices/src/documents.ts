import { createHash } from 'node:crypto';
import { Context, Effect, Layer } from 'effect';
import { InvoiceDatabase } from './database';
import type { Invoice, InvoiceId, Language } from './model';
import { renderInvoice } from './pdf';
import { stored } from './storage';
import { InvoiceStore, type StoreError } from './store';
import * as tables from './tables';

// An invoice as a PDF. An issued invoice is a legal record, so its PDF is
// rendered once per language and kept: every later download, preview, and
// payment page serves those same bytes. Drafts render fresh every time.

export interface DocumentsApi {
  /** The PDF of a stored invoice in `language`, with the invoice it shows. */
  readonly pdf: (
    id: InvoiceId,
    language: Language,
  ) => Effect.Effect<{ invoice: Invoice; bytes: Uint8Array }, StoreError>;
  /**
   * A PDF of an invoice open in the editor. An issued one is read back from
   * the store, so no caller can change its number or totals by claiming it.
   */
  readonly preview: (invoice: Invoice) => Effect.Effect<Uint8Array, StoreError>;
}

export class Documents extends Context.Service<Documents, DocumentsApi>()(
  'Documents',
) {}

const render = (invoice: Invoice, language: Language) =>
  Effect.promise(() => renderInvoice(invoice, language));

export const makeDocuments = Effect.gen(function* () {
  const store = yield* InvoiceStore;
  const db = yield* InvoiceDatabase;

  const pdf = Effect.fn('Documents.pdf')(function* (
    id: InvoiceId,
    language: Language,
  ) {
    const invoice = yield* store.read(id);
    const key = `${id}:${invoice.revision}:${language}`;
    const kept = yield* stored(
      db.query.artifacts.findFirst({ where: { key } }),
    );
    if (kept) return { invoice, bytes: Buffer.from(kept.bytes, 'base64') };
    const bytes = yield* render(invoice, language);
    if (invoice.status === 'issued')
      // Two first renders of one revision race to one row. The first insert
      // wins, and every download after it serves that row's bytes.
      yield* stored(
        db
          .insert(tables.artifacts)
          .values({
            key,
            invoiceId: id,
            language,
            bytes: Buffer.from(bytes).toString('base64'),
            digest: createHash('sha256').update(bytes).digest('hex'),
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing(),
      );
    return { invoice, bytes };
  });

  const api: DocumentsApi = {
    pdf,
    preview: Effect.fn('Documents.preview')(function* (invoice: Invoice) {
      if (invoice.status === 'issued')
        return (yield* pdf(invoice.id, invoice.data.language)).bytes;
      return yield* render(
        { ...invoice, number: null, issuedAt: null },
        invoice.data.language,
      );
    }),
  };
  return Documents.of(api);
});

/** Documents over the store and the invoice database. */
export const documentsLayer = Layer.effect(Documents, makeDocuments);

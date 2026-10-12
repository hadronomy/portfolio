import { createHash } from 'node:crypto';
import { Context, Effect, Layer } from 'effect';
import { calculate } from './calculate';
import { InvoiceDatabase } from './database';
import type { Invoice, InvoiceId, Language } from './model';
import { renderInvoice } from './pdf';
import { defaultsFor, noOffer } from './plan';
import type { QuoteResponse } from './quote-model';
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
  /**
   * An accepted quote's signed copy: the PDF the customer accepted, in the
   * language they read it in, with a last page recording the acceptance
   * and the signature they drew. The answer never changes, so it is kept.
   */
  readonly signed: (
    quote: Invoice,
    acceptance: QuoteResponse,
  ) => Effect.Effect<Uint8Array, StoreError>;
}

export class Documents extends Context.Service<Documents, DocumentsApi>()(
  'Documents',
) {}

export const makeDocuments = Effect.gen(function* () {
  const store = yield* InvoiceStore;
  const db = yield* InvoiceDatabase;

  // A quote prints the plans it offers, which the customer accepts with
  // it: its own, or for a draft the defaults it would take when issued.
  const plansOf = Effect.fnUntraced(function* (invoice: Invoice) {
    if (invoice.data.kind !== 'quote') return [];
    const { plans } = yield* store.offer(invoice.id);
    if (invoice.status === 'issued' || plans !== noOffer.plans) return plans;
    const defaults = defaultsFor(
      yield* store.library(),
      calculate(invoice.data).total,
    );
    return defaults.length ? defaults : plans;
  });

  const render = Effect.fnUntraced(function* (
    invoice: Invoice,
    language: Language,
    acceptance?: QuoteResponse,
  ) {
    const plans = yield* plansOf(invoice);
    return yield* Effect.promise(() =>
      renderInvoice(invoice, language, plans, acceptance),
    );
  });

  /** Bytes kept under `key`, or rendered by `make` and kept for next time. */
  const kept = Effect.fnUntraced(function* (
    key: string,
    invoice: Invoice,
    language: Language,
    make: Effect.Effect<Uint8Array, StoreError>,
    keep: boolean,
  ) {
    const row = yield* stored(db.query.artifacts.findFirst({ where: { key } }));
    if (row) return Buffer.from(row.bytes, 'base64') as Uint8Array;
    const bytes = yield* make;
    if (keep)
      // Two first renders of one revision race to one row. The first insert
      // wins, and every download after it serves that row's bytes.
      yield* stored(
        db
          .insert(tables.artifacts)
          .values({
            key,
            invoiceId: invoice.id,
            language,
            bytes: Buffer.from(bytes).toString('base64'),
            digest: createHash('sha256').update(bytes).digest('hex'),
            createdAt: new Date().toISOString(),
          })
          .onConflictDoNothing(),
      );
    return bytes;
  });

  const pdf = Effect.fn('Documents.pdf')(function* (
    id: InvoiceId,
    language: Language,
  ) {
    const invoice = yield* store.read(id);
    const bytes = yield* kept(
      `${id}:${invoice.revision}:${language}`,
      invoice,
      language,
      render(invoice, language),
      invoice.status === 'issued',
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
    signed: Effect.fn('Documents.signed')(function* (quote, acceptance) {
      return yield* kept(
        `${quote.id}:${quote.revision}:${acceptance.language}:signed`,
        quote,
        acceptance.language,
        render(quote, acceptance.language, acceptance),
        true,
      );
    }),
  };
  return Documents.of(api);
});

/** Documents over the store and the invoice database. */
export const documentsLayer = Layer.effect(Documents, makeDocuments);

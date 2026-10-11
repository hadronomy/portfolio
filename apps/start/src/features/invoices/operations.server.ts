import { Documents } from '@portfolio/invoices/documents';
import type { Invoice, InvoiceId, Language } from '@portfolio/invoices/model';
import { type QuoteError, Quotes } from '@portfolio/invoices/quotes';
import { InvoiceStore, type StoreError } from '@portfolio/invoices/store';
import { Effect, Match } from 'effect';
import { requireOwner } from '../../server/auth.server';
import { Refused, sameOrigin } from '../../server/request.server';
import type { Mutation } from './api';

// The owner's workspace, as effects: read it, change it, preview and
// download its documents. Each one checks who is asking before it reads.

const storeDown = () =>
  new Refused({ status: 503, message: 'The invoice store is unavailable.' });

/** How the page hears a store failure: a missing invoice, or a store it can retry. */
const refusalOf = Match.typeTags<StoreError, Refused>()({
  MissingInvoice: () =>
    new Refused({ status: 404, message: 'Invoice not found.' }),
  InvalidInvoice: storeDown,
  RevisionConflict: storeDown,
  StorageFailure: storeDown,
});

/**
 * A store read as the page sees it. A renderer crash is a defect, and
 * reads as the store being down too.
 */
export const unavailable = <A, R>(effect: Effect.Effect<A, StoreError, R>) =>
  effect.pipe(
    Effect.mapError(refusalOf),
    Effect.catchDefect(() => Effect.fail(storeDown())),
  );

/** Loads the full workspace for the owner. */
export const workspace = Effect.fn('Operations.workspace')(function* () {
  yield* requireOwner;
  return yield* unavailable(InvoiceStore.use((store) => store.workspace()));
});

/** An action's effect, reduced to the document it created, if any. */
const created = <E>(effect: Effect.Effect<Invoice, E>) =>
  Effect.map(effect, (invoice): InvoiceId | null => invoice.id);
const nothing = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.as(effect, null as InvoiceId | null);

/**
 * Applies one workspace edit, then returns the refreshed workspace, with
 * the ID of any draft the edit created, or a recoverable tagged failure.
 */
export const mutate = Effect.fn('Operations.mutate')(function* (
  input: Mutation,
) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  const store = yield* InvoiceStore;
  const quotes = yield* Quotes;
  const apply: Effect.Effect<InvoiceId | null, QuoteError> = Match.value(
    input,
  ).pipe(
    Match.discriminatorsExhaustive('action')({
      save: ({ invoice }) => nothing(store.save(invoice, actor)),
      issue: (issue) => nothing(store.issue(issue, actor)),
      remove: ({ id }) => nothing(store.remove(id, actor)),
      rectify: ({ id }) => created(store.rectify(id, actor)),
      customer: ({ customer }) => nothing(store.customer(customer)),
      item: ({ item }) => nothing(store.item(item)),
      preferences: ({ preferences }) => nothing(store.preferences(preferences)),
      forget: ({ kind, id }) => nothing(store.forget(kind, id)),
      payment: ({ payment }) => nothing(store.payment(payment, actor)),
      'reverse-payment': ({ id }) => nothing(store.reversePayment(id, actor)),
      offer: ({ id, plans }) => nothing(store.setOffer(id, plans, actor)),
      choose: ({ id, plan }) => nothing(store.choose(id, plan, actor)),
      library: ({ library }) => nothing(store.setLibrary(library)),
      revise: ({ id }) => created(quotes.revise(id, actor)),
      bill: ({ id, payment }) => created(quotes.bill(id, payment, actor)),
    }),
  );
  return yield* apply.pipe(
    Effect.flatMap((made) =>
      Effect.map(store.workspace(), (result) => ({ made, result })),
    ),
    Effect.match({
      onSuccess: ({ made, result }) => ({
        ok: true as const,
        workspace: result,
        created: made,
      }),
      onFailure: (error) => ({
        ok: false as const,
        error: error._tag,
        issues: error._tag === 'InvalidInvoice' ? error.issues : [],
        current: error._tag === 'RevisionConflict' ? error.current : null,
        reason: error._tag === 'QuoteClosed' ? error.reason : null,
      }),
    }),
  );
});

/** Renders a preview of the invoice in the editor, as base64 PDF bytes. */
export const preview = Effect.fn('Operations.preview')(function* (
  invoice: Invoice,
) {
  yield* sameOrigin;
  yield* requireOwner;
  const bytes = yield* unavailable(
    Documents.use((documents) => documents.preview(invoice)),
  );
  return Buffer.from(bytes).toString('base64');
});

/** The owner's download of one invoice's PDF. */
export const download = Effect.fn('Operations.download')(function* (
  id: InvoiceId,
  language: Language,
) {
  yield* requireOwner;
  return yield* pdfResponse(id, language);
});

/**
 * The invoice's PDF as a download. Callers decide who may see it; the
 * bytes are the same for every caller.
 */
export const pdfResponse = Effect.fn('Operations.pdfResponse')(function* (
  id: InvoiceId,
  language: Language,
) {
  const { invoice, bytes } = yield* unavailable(
    Documents.use((documents) => documents.pdf(id, language)),
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
});

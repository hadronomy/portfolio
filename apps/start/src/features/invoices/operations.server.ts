import { Documents } from '@portfolio/invoices/documents';
import type { Invoice, InvoiceId, Language } from '@portfolio/invoices/model';
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

/** Applies one workspace edit, then returns the refreshed workspace or a recoverable tagged failure. */
export const mutate = Effect.fn('Operations.mutate')(function* (
  input: Mutation,
) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  const store = yield* InvoiceStore;
  const apply: Effect.Effect<unknown, StoreError> = Match.value(input).pipe(
    Match.discriminatorsExhaustive('action')({
      save: ({ invoice }) => store.save(invoice, actor),
      issue: (issue) => store.issue(issue, actor),
      remove: ({ id }) => store.remove(id, actor),
      rectify: ({ id }) => store.rectify(id, actor),
      customer: ({ customer }) => store.customer(customer),
      item: ({ item }) => store.item(item),
      preferences: ({ preferences }) => store.preferences(preferences),
      forget: ({ kind, id }) => store.forget(kind, id),
      payment: ({ payment }) => store.payment(payment, actor),
      'reverse-payment': ({ id }) => store.reversePayment(id, actor),
      offer: ({ id, plans }) => store.setOffer(id, plans, actor),
      choose: ({ id, plan }) => store.choose(id, plan, actor),
      library: ({ library }) => store.setLibrary(library),
    }),
  );
  return yield* apply.pipe(
    Effect.andThen(store.workspace()),
    Effect.match({
      onSuccess: (result) => ({ ok: true as const, workspace: result }),
      onFailure: (error) => ({
        ok: false as const,
        error: error._tag,
        issues: error._tag === 'InvalidInvoice' ? error.issues : [],
        current: error._tag === 'RevisionConflict' ? error.current : null,
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

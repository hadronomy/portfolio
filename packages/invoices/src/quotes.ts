import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { InvoiceDatabase } from './database';
import { Documents } from './documents';
import { documentLabels } from './labels';
import {
  type LinkInvalid,
  mintLink,
  openLinks,
  resolveLink,
  revokeLinks,
} from './links';
import {
  type Invoice,
  type InvoiceData,
  InvoiceId,
  Language,
  newInvoice,
  type OwnerDid,
  QuoteResponse,
  type QuoteState,
  quoteState,
  RecordId,
} from './model';
import { decodeStored, stored } from './storage';
import { InvoiceStore, type StoreError } from './store';
import * as tables from './tables';

// A quote after it is issued: the link that sends it, the customer's
// answer, and the invoice an accepted quote becomes. An issued quote never
// changes; a revision is a new quote, so an acceptance always names the
// exact document it covers.

/** Why a quote cannot take the step asked of it. */
export class QuoteClosed extends Schema.TaggedError<QuoteClosed>()(
  'QuoteClosed',
  {
    reason: Schema.Literals([
      'not-a-quote',
      'draft',
      'expired',
      'answered',
      'not-accepted',
      'stale-document',
    ]),
  },
) {}

/** What the customer sends back from the quote page. */
export const Answer = Schema.Struct({
  outcome: Schema.Literals(['accepted', 'declined']),
  name: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(200)),
  earlyStart: Schema.Boolean,
  language: Language,
  digest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});
export interface Answer extends Schema.Schema.Type<typeof Answer> {}

/** Who answered, as the request shows it: the evidence kept with an acceptance. */
export interface Evidence {
  readonly address: string;
  readonly agent: string;
}

/** A quote as its customer's page shows it. */
export interface QuoteView {
  readonly quote: Invoice;
  readonly response: QuoteResponse | null;
  readonly state: QuoteState;
  /** SHA-256 of the PDF in each language, as the page shows and the answer names. */
  readonly digests: Readonly<Record<Language, string>>;
}

export type QuoteError = StoreError | QuoteClosed;

export interface QuotesApi {
  /** Mints a link to an open quote for its customer. */
  readonly share: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<
    { readonly token: string; readonly expiresAt: string },
    QuoteError
  >;
  /** Closes every open link to the quote. */
  readonly revoke: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<number, StoreError>;
  /** How many links to the quote are open. */
  readonly links: (id: InvoiceId) => Effect.Effect<number, StoreError>;
  /** The quote a link opens; any other document is not a quote link. */
  readonly resolve: (
    token: string,
  ) => Effect.Effect<InvoiceId, QuoteError | LinkInvalid>;
  /** The quote with its answer and state. */
  readonly view: (id: InvoiceId) => Effect.Effect<QuoteView, QuoteError>;
  /**
   * Records the customer's answer once. Answering again with the same
   * outcome returns the first answer; the other outcome is refused.
   */
  readonly respond: (
    id: InvoiceId,
    answer: Answer,
    evidence: Evidence,
  ) => Effect.Effect<QuoteResponse, QuoteError>;
  /** Notes that the confirmation email went out. */
  readonly confirmed: (id: InvoiceId) => Effect.Effect<void, StoreError>;
  /**
   * Drafts the invoice for an accepted quote, with its lines and a
   * reference to it. Asking again returns the same draft.
   */
  readonly convert: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, QuoteError>;
  /** Starts a new draft quote from an issued one, valid for another 30 days. */
  readonly revise: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, QuoteError>;
}

export class Quotes extends Context.Service<Quotes, QuotesApi>()('Quotes') {}

/** The handle a `db.transaction` callback receives. */
type Transaction = Parameters<
  Parameters<InvoiceDatabase['Service']['transaction']>[0]
>[0];

const decodeResponse = decodeStored(QuoteResponse);
const today = () => new Date().toISOString().slice(0, 10);
const digestOf = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const plusDays = (day: string, days: number) => {
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

export const makeQuotes = Effect.gen(function* () {
  const db = yield* InvoiceDatabase;
  const store = yield* InvoiceStore;
  const documents = yield* Documents;

  const response = Effect.fnUntraced(function* (id: InvoiceId) {
    const row = yield* stored(
      db.query.responses.findFirst({ where: { quoteId: id } }),
    );
    return row ? yield* decodeResponse(row) : null;
  });

  const quote = Effect.fnUntraced(function* (id: InvoiceId) {
    const found = yield* store.read(id);
    if (found.data.kind !== 'quote')
      return yield* new QuoteClosed({ reason: 'not-a-quote' });
    return found;
  });

  const view = Effect.fn('Quotes.view')(function* (id: InvoiceId) {
    const found = yield* quote(id);
    const answer = yield* response(id);
    const digests = { en: '', es: '' };
    if (found.status === 'issued')
      for (const language of Language.literals)
        digests[language] = digestOf(
          (yield* documents.pdf(id, language)).bytes,
        );
    return {
      quote: found,
      response: answer,
      state: quoteState(found, answer, today()),
      digests,
    };
  });

  const insertDraft = Effect.fnUntraced(function* (
    tx: Transaction,
    next: Invoice,
    actor: OwnerDid,
    operation: string,
    from: InvoiceId,
  ) {
    yield* tx.insert(tables.invoices).values({
      id: next.id,
      status: 'draft',
      revision: 1,
      payload: next,
      updatedAt: next.updatedAt,
    });
    yield* tx.insert(tables.audit).values({
      id: crypto.randomUUID(),
      invoiceId: next.id,
      operation,
      actor,
      payload: { quoteId: from },
      createdAt: next.createdAt,
    });
  });

  const api: QuotesApi = {
    share: Effect.fn('Quotes.share')(function* (id, actor) {
      const { state } = yield* view(id);
      if (state === 'draft') return yield* new QuoteClosed({ reason: 'draft' });
      if (state === 'expired')
        return yield* new QuoteClosed({ reason: 'expired' });
      if (state !== 'open')
        return yield* new QuoteClosed({ reason: 'answered' });
      return yield* mintLink(db, id, actor, 'quote-link-created');
    }),

    revoke: Effect.fn('Quotes.revoke')((id, actor) =>
      revokeLinks(db, id, actor, 'quote-links-revoked'),
    ),

    links: Effect.fn('Quotes.links')((id) => openLinks(db, id)),

    resolve: Effect.fn('Quotes.resolve')(function* (token) {
      const id = yield* resolveLink(db, token);
      yield* quote(id);
      return id;
    }),

    view,

    respond: Effect.fn('Quotes.respond')(function* (id, answer, evidence) {
      const current = yield* view(id);
      if (current.response) {
        if (current.response.outcome === answer.outcome)
          return current.response;
        return yield* new QuoteClosed({ reason: 'answered' });
      }
      if (current.state === 'draft')
        return yield* new QuoteClosed({ reason: 'draft' });
      if (current.state === 'expired')
        return yield* new QuoteClosed({ reason: 'expired' });
      // The answer covers the PDF the customer read. A digest that no longer
      // matches means the page is out of date, never a different document.
      if (current.digests[answer.language] !== answer.digest)
        return yield* new QuoteClosed({ reason: 'stale-document' });
      const consumer = current.quote.data.customerType === 'consumer';
      const saved: QuoteResponse = {
        quoteId: id,
        outcome: answer.outcome,
        name: answer.name.trim(),
        email: current.quote.data.customer.email,
        earlyStart:
          consumer && answer.outcome === 'accepted' && answer.earlyStart,
        language: answer.language,
        digest: answer.digest,
        address: evidence.address,
        agent: evidence.agent.slice(0, 500),
        decidedAt: new Date().toISOString(),
        confirmedAt: null,
        invoiceId: null,
      };
      yield* stored(
        db.transaction((tx) =>
          Effect.gen(function* () {
            // Two answers racing to one quote: the primary key keeps the first.
            const inserted = yield* tx
              .insert(tables.responses)
              .values(saved)
              .onConflictDoNothing()
              .returning();
            if (!inserted.length) return;
            yield* tx.insert(tables.audit).values({
              id: crypto.randomUUID(),
              invoiceId: id,
              operation: `quote-${answer.outcome}`,
              actor: 'customer',
              payload: {
                name: saved.name,
                digest: saved.digest,
                earlyStart: saved.earlyStart,
              },
              createdAt: saved.decidedAt,
            });
          }),
        ),
      );
      const kept = yield* response(id);
      if (!kept || kept.outcome !== answer.outcome)
        return yield* new QuoteClosed({ reason: 'answered' });
      return kept;
    }),

    confirmed: Effect.fn('Quotes.confirmed')(function* (id) {
      yield* stored(
        db
          .update(tables.responses)
          .set({ confirmedAt: new Date().toISOString() })
          .where(eq(tables.responses.quoteId, id)),
      );
    }),

    convert: Effect.fn('Quotes.convert')(function* (id, actor) {
      const source = yield* quote(id);
      return yield* stored(
        db.transaction((tx) =>
          Effect.gen(function* () {
            const [row] = yield* tx
              .select()
              .from(tables.responses)
              .where(eq(tables.responses.quoteId, id))
              .for('update');
            if (!row || row.outcome !== 'accepted')
              return yield* new QuoteClosed({ reason: 'not-accepted' });
            if (row.invoiceId)
              return yield* store.read(InvoiceId.make(row.invoiceId));
            const draft = newInvoice();
            const t = documentLabels[source.data.language];
            const data: InvoiceData = {
              ...source.data,
              kind: 'invoice',
              quote: null,
              correction: null,
              issueDate: draft.data.issueDate,
              supplyDate: draft.data.supplyDate,
              dueDate: draft.data.dueDate,
              reference: `${t.quote} ${source.number ?? ''}`.trim(),
              lines: source.data.lines.map((line) => ({
                ...line,
                id: RecordId.make(crypto.randomUUID()),
              })),
            };
            const next: Invoice = { ...draft, data };
            yield* insertDraft(tx, next, actor, 'quote-invoiced', id);
            yield* tx
              .update(tables.responses)
              .set({ invoiceId: next.id })
              .where(eq(tables.responses.quoteId, id));
            return next;
          }),
        ),
      );
    }),

    revise: Effect.fn('Quotes.revise')(function* (id, actor) {
      const source = yield* quote(id);
      if (source.status === 'draft')
        return yield* new QuoteClosed({ reason: 'draft' });
      const draft = newInvoice();
      const issueDate = draft.data.issueDate;
      const next: Invoice = {
        ...draft,
        data: {
          ...source.data,
          issueDate,
          supplyDate:
            source.data.supplyDate < issueDate
              ? issueDate
              : source.data.supplyDate,
          quote: source.data.quote && {
            ...source.data.quote,
            validUntil: plusDays(issueDate, 30),
          },
        },
      };
      yield* stored(
        db.transaction((tx) =>
          insertDraft(tx, next, actor, 'quote-revised', id),
        ),
      );
      return next;
    }),
  };
  return Quotes.of(api);
});

/** Quotes over the store, the documents, and the invoice database. */
export const quotesLayer = Layer.effect(Quotes, makeQuotes);

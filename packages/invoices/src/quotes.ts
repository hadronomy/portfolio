import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { billData, bills } from '#billing';
import { InvoiceDatabase } from '#database';
import { Documents } from '#documents';
import {
  createLink,
  type LinkInvalid,
  mintLink,
  openLinks,
  resolveLink,
  revokeLinks,
} from '#links';
import {
  type Customer,
  Invoice,
  InvoiceId,
  Language,
  MissingInvoice,
  newInvoice,
  type OwnerDid,
  RecordId,
} from '#model';
import { enqueueMail } from '#outbox';
import type { MailKind } from '#outbox-model';
import { PaymentPlan } from '#plan';
import {
  type CustomerDetails,
  DetailsConfirmation,
  type DetailsState,
  detailsChanges,
  detailsIssues,
  detailsState,
  InvalidDetails,
  territoryOf,
  tidyDetails,
} from '#quote-details';
import {
  type Answer,
  QuoteEmail,
  QuoteResponse,
  type QuoteState,
  quoteState,
} from '#quote-model';
import { decodeStored, stored } from '#storage';
import { InvoiceStore, type StoreError } from '#store';
import * as tables from '#tables';

// Customer confirmation creates a revision of the same quote. The answer
// binds to that revision's PDF. An owner's revision creates a new quote.

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
      'no-such-plan',
      'no-such-payment',
      'unsigned',
      'details-unconfirmed',
      'needs-revision',
    ]),
  },
) {}

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
  readonly details: DetailsState;
  /** SHA-256 of the PDF in each language, as the page shows and the answer names. */
  readonly digests: Readonly<Record<Language, string>>;
}

export type QuoteError = StoreError | QuoteClosed;

export interface QuotesApi {
  /** Creates the customer's link and queues each recipient in the same transaction. */
  readonly invite: (
    id: InvoiceId,
    actor: OwnerDid,
    request: {
      readonly base: string;
      readonly to: string;
      readonly note: string;
      readonly copy: boolean;
    },
  ) => Effect.Effect<
    {
      readonly expiresAt: string;
      readonly emails: readonly {
        readonly id: string;
        readonly kind: MailKind;
      }[];
    },
    QuoteError
  >;
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
  /** The latest confirmation state, without rendering PDFs. */
  readonly details: (id: InvoiceId) => Effect.Effect<DetailsState, StoreError>;
  /** Confirms identity, revises the PDF, and updates the directory in one transaction. */
  readonly confirmDetails: (
    id: InvoiceId,
    details: CustomerDetails,
    evidence: Evidence,
  ) => Effect.Effect<DetailsState, QuoteError | InvalidDetails>;
  /**
   * Records the customer's answer once. Answering again with the same
   * outcome returns the first answer; the other outcome is refused.
   */
  readonly respond: (
    id: InvoiceId,
    answer: Answer,
    evidence: Evidence,
    mail: { readonly url: string; readonly workspaceUrl: string },
  ) => Effect.Effect<QuoteResponse, QuoteError>;
  /**
   * Drafts the invoice for `payment` of an accepted quote's plan: its
   * share of every quoted line, due on the payment's date. Asking again
   * returns the same draft.
   */
  readonly bill: (
    id: InvoiceId,
    payment: number,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, QuoteError>;
  /** Every time the quote was emailed, newest first. */
  readonly emails: (
    id: InvoiceId,
  ) => Effect.Effect<readonly QuoteEmail[], StoreError>;
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
const decodePlan = decodeStored(PaymentPlan);
const decodeEmail = decodeStored(QuoteEmail);
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
    if (!row) return null;
    const billed = yield* stored(
      db
        .select({
          payment: tables.billed.payment,
          invoiceId: tables.billed.invoiceId,
        })
        .from(tables.billed)
        .where(eq(tables.billed.quoteId, id))
        .orderBy(tables.billed.payment),
    );
    return yield* decodeResponse({ ...row, billed });
  });

  const quote = Effect.fnUntraced(function* (id: InvoiceId) {
    const found = yield* store.read(id);
    if (found.data.kind !== 'quote')
      return yield* new QuoteClosed({ reason: 'not-a-quote' });
    return found;
  });

  const confirmation = Effect.fnUntraced(function* (
    id: InvoiceId,
    source: InvoiceDatabase['Service'] | Transaction = db,
  ) {
    const [row] = yield* stored(
      source
        .select()
        .from(tables.audit)
        .where(
          and(
            eq(tables.audit.invoiceId, id),
            eq(tables.audit.operation, 'quote-details-confirmed'),
          ),
        )
        .orderBy(desc(tables.audit.createdAt))
        .limit(1),
    );
    return row ? yield* decodeStored(DetailsConfirmation)(row.payload) : null;
  });
  const details = Effect.fn('Quotes.details')(function* (id: InvoiceId) {
    return detailsState(yield* confirmation(id));
  });

  const openQuote = Effect.fnUntraced(function* (
    tx: Transaction,
    id: InvoiceId,
  ) {
    const [row] = yield* tx
      .select()
      .from(tables.invoices)
      .where(eq(tables.invoices.id, id))
      .for('update');
    if (!row) return yield* new MissingInvoice({ id });
    const current = yield* decodeStored(Invoice)(row.payload);
    if (current.data.kind !== 'quote')
      return yield* new QuoteClosed({ reason: 'not-a-quote' });
    if (current.status === 'draft')
      return yield* new QuoteClosed({ reason: 'draft' });
    if ((current.data.quote?.validUntil ?? current.data.dueDate) < today())
      return yield* new QuoteClosed({ reason: 'expired' });
    const [answer] = yield* tx
      .select()
      .from(tables.responses)
      .where(eq(tables.responses.quoteId, id));
    if (answer) return yield* new QuoteClosed({ reason: 'answered' });
    return current;
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
      details: yield* details(id),
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
    invite: Effect.fn('Quotes.invite')(function* (id, actor, request) {
      const current = yield* view(id);
      if (current.state === 'draft')
        return yield* new QuoteClosed({ reason: 'draft' });
      if (current.state === 'expired')
        return yield* new QuoteClosed({ reason: 'expired' });
      if (current.state !== 'open')
        return yield* new QuoteClosed({ reason: 'answered' });
      return yield* stored(
        db.transaction((tx) =>
          Effect.gen(function* () {
            const link = yield* createLink(tx, id, actor, 'quote-link-created');
            const expiresAt = new Date(
              Math.min(
                Date.parse(link.expiresAt),
                Date.parse(
                  `${current.quote.data.quote?.validUntil ?? current.quote.data.dueDate}T23:59:59.999Z`,
                ),
              ),
            ).toISOString();
            const payload = {
              _tag: 'Invitation' as const,
              url: `${request.base}/invoices/quote/${link.token}`,
              note: request.note,
              expiresAt,
              actor,
            };
            const key = `quote-invitation/${crypto.randomUUID()}`;
            const emails = yield* enqueueMail(tx, [
              {
                invoiceId: id,
                kind: 'quote-invitation',
                recipient: request.to,
                payload,
                key: `${key}/customer`,
                expiresAt,
              },
              ...(request.copy && current.quote.data.issuer.email
                ? [
                    {
                      invoiceId: id,
                      kind: 'quote-copy' as const,
                      recipient: current.quote.data.issuer.email,
                      payload,
                      key: `${key}/owner`,
                      expiresAt,
                    },
                  ]
                : []),
            ]);
            return { expiresAt, emails };
          }),
        ),
      );
    }),
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

    emails: Effect.fn('Quotes.emails')(function* (id) {
      const rows = yield* stored(
        db
          .select({ payload: tables.audit.payload })
          .from(tables.audit)
          .where(
            and(
              eq(tables.audit.invoiceId, id),
              eq(tables.audit.operation, 'quote-emailed'),
            ),
          )
          .orderBy(desc(tables.audit.createdAt)),
      );
      return yield* Effect.forEach(rows, (row) => decodeEmail(row.payload));
    }),

    resolve: Effect.fn('Quotes.resolve')(function* (token) {
      const id = yield* resolveLink(db, token);
      yield* quote(id);
      return id;
    }),

    view,
    details,
    confirmDetails: Effect.fn('Quotes.confirmDetails')(
      function* (id, supplied, evidence) {
        const confirmed = tidyDetails(supplied);
        const issues = detailsIssues(confirmed);
        if (issues.length) return yield* new InvalidDetails({ issues });
        return yield* stored(
          db.transaction((tx) =>
            Effect.gen(function* () {
              const current = yield* openQuote(tx, id);
              const prior = yield* confirmation(id, tx);
              const original = prior?.original ?? current;
              const territory = territoryOf(confirmed.customer.address);
              const territoryChanged =
                territory !== original.data.customerTerritory;
              const typeChanged =
                confirmed.customerType !== original.data.customerType;
              const reason =
                territoryChanged && typeChanged
                  ? ('territory-and-type' as const)
                  : territoryChanged
                    ? ('territory' as const)
                    : typeChanged
                      ? ('customer-type' as const)
                      : null;
              const confirmedAt = new Date().toISOString();
              const customerId =
                current.data.customerId ?? RecordId.make(crypto.randomUUID());
              const customer: Customer = {
                id: customerId,
                ...confirmed.customer,
                type: confirmed.customerType,
                territory,
                language: current.data.language,
              };
              // Keyed exactly as the directory keys it, so the saved customer is
              // updated in place rather than listed twice.
              yield* tx
                .insert(tables.records)
                .values({
                  key: customerId,
                  kind: 'customer',
                  payload: customer,
                })
                .onConflictDoUpdate({
                  target: tables.records.key,
                  set: { payload: customer },
                });
              const next: Invoice = {
                ...current,
                revision: current.revision + 1,
                updatedAt: confirmedAt,
                // The customer's identity only. Their type and territory decide the
                // taxes and the legal notices the quote prints, which stay the
                // owner's until the owner revises it.
                data: {
                  ...current.data,
                  customer: confirmed.customer,
                  customerId,
                },
              };
              yield* tx
                .update(tables.invoices)
                .set({
                  payload: next,
                  revision: next.revision,
                  updatedAt: confirmedAt,
                })
                .where(eq(tables.invoices.id, id));
              const saved: DetailsConfirmation = {
                confirmedAt,
                reason,
                territory,
                customerType: confirmed.customerType,
                changes: detailsChanges(original, confirmed),
                before: current,
                original,
                revision: next.revision,
                address: evidence.address,
                agent: evidence.agent.slice(0, 500),
              };
              yield* tx.insert(tables.audit).values({
                id: crypto.randomUUID(),
                invoiceId: id,
                operation: 'quote-details-confirmed',
                actor: 'customer',
                payload: saved,
                createdAt: confirmedAt,
              });
              return detailsState(saved);
            }),
          ),
        );
      },
    ),

    respond: Effect.fn('Quotes.respond')(
      function* (id, answer, evidence, mail) {
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
        if (current.details.state === 'waiting')
          return yield* new QuoteClosed({ reason: 'details-unconfirmed' });
        if (current.details.state === 'needs-revision')
          return yield* new QuoteClosed({ reason: 'needs-revision' });
        // The answer covers the PDF the customer read. A digest that no longer
        // matches means the page is out of date, never a different document.
        if (current.digests[answer.language] !== answer.digest)
          return yield* new QuoteClosed({ reason: 'stale-document' });
        const consumer = current.quote.data.customerType === 'consumer';
        // The customer accepts under one of the plans the quote offers; with
        // one plan, that one. A declined quote keeps none.
        const { plans } = yield* store.offer(id);
        const plan =
          answer.outcome === 'declined'
            ? null
            : answer.plan === null
              ? plans.length === 1
                ? plans[0]
                : undefined
              : plans.find((item) => item.id === answer.plan);
        if (plan === undefined)
          return yield* new QuoteClosed({ reason: 'no-such-plan' });
        if (answer.outcome === 'accepted' && !answer.signature)
          return yield* new QuoteClosed({ reason: 'unsigned' });
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
          signature: answer.outcome === 'accepted' ? answer.signature : null,
          plan,
          billed: [],
        };
        yield* stored(
          db.transaction((tx) =>
            Effect.gen(function* () {
              // Confirmation and answers share this lock, so the digest and
              // recipient cannot change between validation and acceptance.
              const [locked] = yield* tx
                .select()
                .from(tables.invoices)
                .where(eq(tables.invoices.id, id))
                .for('update');
              const [previous] = yield* tx
                .select()
                .from(tables.responses)
                .where(eq(tables.responses.quoteId, id));
              if (previous) return;
              if (!locked || locked.revision !== current.quote.revision)
                return yield* new QuoteClosed({ reason: 'stale-document' });
              yield* openQuote(tx, id);
              const state = detailsState(yield* confirmation(id, tx));
              if (state.state === 'waiting')
                return yield* new QuoteClosed({
                  reason: 'details-unconfirmed',
                });
              if (state.state === 'needs-revision')
                return yield* new QuoteClosed({ reason: 'needs-revision' });
              const { billed: _none, ...row } = saved;
              const inserted = yield* tx
                .insert(tables.responses)
                .values(row)
                .onConflictDoNothing()
                .returning();
              if (!inserted.length) return;
              yield* enqueueMail(tx, [
                {
                  invoiceId: id,
                  kind: 'quote-answer',
                  recipient: saved.email,
                  payload: { _tag: 'Answer', ...mail },
                  key: `quote-answer/${id}/customer`,
                },
                ...(current.quote.data.issuer.email
                  ? [
                      {
                        invoiceId: id,
                        kind: 'quote-answered' as const,
                        recipient: current.quote.data.issuer.email,
                        payload: { _tag: 'Answer' as const, ...mail },
                        key: `quote-answer/${id}/owner`,
                      },
                    ]
                  : []),
              ]);
              yield* tx.insert(tables.audit).values({
                id: crypto.randomUUID(),
                invoiceId: id,
                operation: `quote-${answer.outcome}`,
                actor: 'customer',
                payload: {
                  name: saved.name,
                  digest: saved.digest,
                  earlyStart: saved.earlyStart,
                  plan: saved.plan?.id ?? null,
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
      },
    ),

    bill: Effect.fn('Quotes.bill')(function* (id, payment, actor) {
      const source = yield* quote(id);
      return yield* stored(
        db.transaction((tx) =>
          Effect.gen(function* () {
            // The answer row is the lock: two drafts of one payment wait on
            // each other, and the second finds the first.
            const [row] = yield* tx
              .select()
              .from(tables.responses)
              .where(eq(tables.responses.quoteId, id))
              .for('update');
            if (!row || row.outcome !== 'accepted' || !row.plan)
              return yield* new QuoteClosed({ reason: 'not-accepted' });
            const [made] = yield* tx
              .select()
              .from(tables.billed)
              .where(
                and(
                  eq(tables.billed.quoteId, id),
                  eq(tables.billed.payment, payment),
                ),
              );
            if (made) return yield* store.read(InvoiceId.make(made.invoiceId));
            const plan = yield* decodePlan(row.plan);
            const payments = bills(
              source.data,
              plan,
              row.decidedAt.slice(0, 10),
            );
            if (!payments[payment])
              return yield* new QuoteClosed({ reason: 'no-such-payment' });
            const draft = newInvoice();
            const next: Invoice = {
              ...draft,
              data: billData(
                source.data,
                source.number ?? '',
                payments,
                payment,
                draft.data.issueDate,
              ),
            };
            yield* insertDraft(tx, next, actor, 'quote-billed', id);
            yield* tx
              .insert(tables.billed)
              .values({ quoteId: id, payment, invoiceId: next.id });
            return next;
          }),
        ),
      );
    }),

    revise: Effect.fn('Quotes.revise')(function* (id, actor) {
      const source = yield* quote(id);
      if (source.status === 'draft')
        return yield* new QuoteClosed({ reason: 'draft' });
      const confirmed = yield* details(id);
      const draft = newInvoice();
      const issueDate = draft.data.issueDate;
      const next: Invoice = {
        ...draft,
        data: {
          ...source.data,
          // A revision adopts what the customer confirmed, which may change
          // its taxes and notices: that is why it is the owner's step.
          ...(confirmed.state !== 'waiting' && {
            customerTerritory: confirmed.territory,
            customerType: confirmed.customerType,
          }),
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

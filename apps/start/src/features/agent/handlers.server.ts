import { calculate } from '@portfolio/invoices/calculate';
import { clauses } from '@portfolio/invoices/clauses';
import {
  asQuote,
  type Invoice,
  type InvoiceData,
  type InvoiceId,
  type Line,
  newInvoice,
  newLine,
  type OwnerDid,
  RecordId,
} from '@portfolio/invoices/model';
import { pagesFromMarkdown, pagesToMarkdown } from '@portfolio/invoices/pages';
import { noOffer } from '@portfolio/invoices/plan';
import { type QuoteError, Quotes } from '@portfolio/invoices/quotes';
import { InvoiceStore, type Workspace } from '@portfolio/invoices/store';
import { issueErrors } from '@portfolio/invoices/validate';
import { Effect, Match, Result } from 'effect';
import { AppConfig } from '../../server/config.server';
import { agentOrigin } from '../../server/origin.server';
import type { Payments } from '../../server/payments.server';
import { ownerDid } from '../auth/options';
import type { Mutation } from '../invoices/api';
import {
  linkStatus,
  revokeLinks,
  shareLink,
} from '../invoices/collection.server';
import { perform } from '../invoices/operations.server';
import { sendQuote } from '../invoices/quotes.server';
import { shareFailureMessage } from '../invoices/share-words';
import { documentStatus } from '../invoices/status';
import {
  type DocumentRow,
  type DraftChanges,
  InvoiceTools,
  type LineInput,
  ToolFailure,
} from './tools';

// The tools at work. Each one finds what it was pointed at, runs the
// operation the invoice pages run, as the owner, and reads the result back
// from the store. Every failure becomes one sentence that tells the agent
// what to do next.

const fail = (message: string) => Effect.fail(new ToolFailure({ message }));

const closed: Record<string, string> = {
  'not-a-quote': 'That document is not a quote.',
  draft: 'Issue the quote first.',
  expired:
    'The quote has expired. Revise it with revise_quote to send a new version.',
  answered: 'The customer has already answered this quote.',
  'not-accepted':
    'The quote is not accepted. Only an accepted quote is billed.',
  'stale-document':
    'The quote changed after it was shown to the customer. Send it again.',
  'no-such-plan': 'The quote does not offer that payment plan.',
  'no-such-payment':
    'The accepted plan has no payment at that place. Read the plan in get_document; payments count from 0.',
};

/** A store or quote failure, as the agent should hear it. */
const explain = Match.typeTags<QuoteError, ToolFailure>()({
  MissingInvoice: () =>
    new ToolFailure({
      message: 'No such document. Find it with list_documents.',
    }),
  InvalidInvoice: ({ issues }) =>
    new ToolFailure({
      message: `The document is not valid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    }),
  RevisionConflict: ({ current }) =>
    new ToolFailure({
      message: `The document changed since you read it; it is at revision ${current.revision} now. Read it again with get_document and retry with that revision.`,
    }),
  StorageFailure: () =>
    new ToolFailure({
      message: 'The invoice store is unavailable. Try again shortly.',
    }),
  QuoteClosed: ({ reason }) =>
    new ToolFailure({ message: closed[reason] ?? 'The quote cannot do that.' }),
});

const explained = <A, R>(effect: Effect.Effect<A, QuoteError, R>) =>
  Effect.mapError(effect, explain);

const today = () => new Date().toISOString().slice(0, 10);

/** The document `ref` names: by ID, or by number in any case. */
function find(workspace: Workspace, ref: string) {
  const wanted = ref.trim().toLowerCase();
  const found = workspace.invoices.find(
    (invoice) =>
      invoice.id === wanted || invoice.number?.toLowerCase() === wanted,
  );
  return found
    ? Effect.succeed(found)
    : fail(
        `No document is called “${ref}”. Find it with list_documents; use its ID, or its number once issued.`,
      );
}

function row(invoice: Invoice, workspace: Workspace): DocumentRow {
  const { status, total, remaining } = documentStatus(
    invoice,
    workspace.payments,
    workspace.responses,
  );
  return {
    id: invoice.id,
    number: invoice.number,
    kind: invoice.data.kind,
    status,
    title: invoice.data.title,
    customer: invoice.data.customer.name,
    issueDate: invoice.data.issueDate,
    dueDate: invoice.data.dueDate,
    validUntil: invoice.data.quote?.validUntil ?? null,
    currency: invoice.data.currency,
    total,
    outstanding: invoice.data.kind === 'quote' ? '0.00' : remaining,
  };
}

/** A line as written, on top of the line it replaces or the editor's new line. */
function lineFrom(input: LineInput, existing: readonly Line[]): Line {
  const base =
    (input.id && existing.find((line) => line.id === input.id)) || newLine();
  const defined = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<Line>;
  return {
    ...base,
    ...defined,
    id: input.id ? RecordId.make(input.id) : base.id,
  };
}

/** The draft's data with `changes` applied, or why they cannot be. */
const apply = Effect.fn('AgentTools.apply')(function* (
  data: InvoiceData,
  changes: DraftChanges,
  workspace: Workspace,
) {
  let next: InvoiceData = { ...data };
  const { customer, lines, validUntil, pages, ...plain } = changes;
  for (const [key, value] of Object.entries(plain))
    if (value !== undefined) next = { ...next, [key]: value };
  if (customer !== undefined) {
    const found = workspace.customers.find((entry) => entry.id === customer);
    if (!found)
      return yield* fail(
        'No customer has that ID. Find one with list_customers, or add one with save_customer.',
      );
    const { id, type, territory, language, ...party } = found;
    next = {
      ...next,
      customer: party,
      customerId: id,
      customerType: type,
      customerTerritory: territory,
      language: changes.language ?? language,
    };
  }
  if (lines !== undefined)
    next = { ...next, lines: lines.map((line) => lineFrom(line, data.lines)) };
  if (validUntil !== undefined || pages !== undefined) {
    if (!next.quote)
      return yield* fail(
        'Only a quote has a validity date and pages. Create one with kind "quote".',
      );
    let terms = next.quote;
    if (validUntil !== undefined) terms = { ...terms, validUntil };
    if (pages !== undefined) {
      const parsed = pagesFromMarkdown(pages);
      if (Result.isFailure(parsed))
        return yield* fail(`The pages cannot be read: ${parsed.failure}`);
      terms = { ...terms, pages: parsed.success };
    }
    next = { ...next, quote: terms };
  }
  return next;
});

const totalsOf = (data: InvoiceData) => {
  const totals = calculate(data);
  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    withholding: totals.withholding,
    total: totals.total,
  };
};

const searchable = (...values: readonly (string | null | undefined)[]) =>
  values.filter(Boolean).join(' ').toLowerCase();

export const invoiceToolsLayer = InvoiceTools.toLayer(
  Effect.gen(function* () {
    const store = yield* InvoiceStore;
    const quotes = yield* Quotes;
    const settings = yield* AppConfig;
    // Online payments may be off; the link operations answer for that.
    const online = yield* Effect.context<Payments>();
    // An agent acts for the owner, and only the owner's grant reaches here.
    const actor = ownerDid as OwnerDid;
    const base = agentOrigin({
      configured: settings.origin,
      production: settings.production,
    });
    const snapshot = explained(store.workspace());
    const run = (mutation: Mutation) => explained(perform(actor, mutation));
    /** The document `id` as it now stands, for a tool's answer. */
    const reread = (id: InvoiceId) =>
      Effect.flatMap(snapshot, (workspace) =>
        Effect.map(find(workspace, id), (invoice) => ({
          document: row(invoice, workspace),
        })),
      );
    const draft = (workspace: Workspace, ref: string) =>
      Effect.flatMap(find(workspace, ref), (invoice) =>
        invoice.status === 'draft'
          ? Effect.succeed(invoice)
          : fail(
              `${invoice.number} is issued and cannot change. Revise a quote with revise_quote, or correct an invoice with rectify_invoice.`,
            ),
      );
    const provide = <A, R>(effect: Effect.Effect<A, ToolFailure, R>) =>
      effect.pipe(
        Effect.provideService(InvoiceStore, store),
        Effect.provideService(Quotes, quotes),
      );

    return InvoiceTools.of({
      list_documents: ({ kind, status, search, limit }) =>
        Effect.map(snapshot, (workspace) => {
          const wanted = search?.trim().toLowerCase();
          const rows = workspace.invoices
            .map((invoice) => row(invoice, workspace))
            .filter(
              (entry) =>
                (!kind || entry.kind === kind) &&
                (!status || entry.status === status) &&
                (!wanted ||
                  searchable(
                    entry.number,
                    entry.title,
                    entry.customer,
                  ).includes(wanted)),
            )
            .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
          const size = Math.min(Math.max(limit ?? 25, 1), 100);
          return {
            documents: rows.slice(0, size),
            more: Math.max(rows.length - size, 0),
          };
        }),

      get_document: ({ document }) =>
        Effect.gen(function* () {
          const workspace = yield* snapshot;
          const invoice = yield* find(workspace, document);
          const data = invoice.data;
          const offer = workspace.offers[invoice.id] ?? noOffer;
          const openLinks =
            data.kind === 'quote'
              ? yield* explained(quotes.links(invoice.id))
              : yield* linkStatus(invoice.id).pipe(
                  Effect.map((status) =>
                    status._tag === 'Open' ? status.links : 0,
                  ),
                  Effect.catchTag('Refused', () => Effect.succeed(0)),
                );
          return {
            ...row(invoice, workspace),
            revision: invoice.revision,
            data,
            totals: totalsOf(data),
            issueBlockers:
              invoice.status === 'draft' ? [...issueErrors(data)] : [],
            payments: workspace.payments.filter(
              (payment) => payment.invoiceId === invoice.id,
            ),
            plans: [...offer.plans],
            chosenPlan: offer.chosen,
            pages: data.quote ? pagesToMarkdown(data.quote.pages) : null,
            answer: workspace.responses[invoice.id] ?? null,
            pdf: `invoices://documents/${invoice.id}/${data.language}.pdf`,
            openLinks,
          };
        }).pipe(Effect.provide(online)),

      list_customers: ({ search }) =>
        Effect.map(snapshot, (workspace) => {
          const wanted = search?.trim().toLowerCase();
          return {
            customers: workspace.customers.filter(
              (customer) =>
                !wanted ||
                searchable(
                  customer.name,
                  customer.taxId,
                  customer.email,
                ).includes(wanted),
            ),
          };
        }),

      list_catalog: ({ search }) =>
        Effect.map(snapshot, (workspace) => {
          const wanted = search?.trim().toLowerCase();
          return {
            items: workspace.items.filter(
              (item) =>
                !wanted ||
                searchable(item.name, item.description).includes(wanted),
            ),
          };
        }),

      get_settings: () =>
        Effect.map(snapshot, (workspace) => ({
          preferences: workspace.preferences,
          library: workspace.library,
        })),

      list_clauses: () =>
        Effect.succeed({
          clauses: clauses.flatMap((clause) =>
            clause.versions.map((version) => ({
              id: clause.id,
              version: version.version,
              audience: version.audience,
              source: version.source,
              en: version.text.en,
              es: version.text.es,
            })),
          ),
        }),

      create_draft: ({ kind, changes }) =>
        Effect.gen(function* () {
          const workspace = yield* snapshot;
          const fresh = newInvoice(workspace.preferences);
          const data = kind === 'quote' ? asQuote(fresh.data) : fresh.data;
          const invoice = {
            ...fresh,
            data: yield* apply(data, changes ?? {}, workspace),
          };
          yield* run({ action: 'save', invoice });
          return yield* reread(invoice.id);
        }).pipe(provide),

      update_draft: ({ document, revision, changes }) =>
        Effect.gen(function* () {
          const workspace = yield* snapshot;
          const invoice = yield* draft(workspace, document);
          if (invoice.revision !== revision)
            return yield* fail(
              `The draft is at revision ${invoice.revision}, not ${revision}. Read it again with get_document before changing it.`,
            );
          yield* run({
            action: 'save',
            invoice: {
              ...invoice,
              data: yield* apply(invoice.data, changes, workspace),
            },
          });
          return yield* reread(invoice.id);
        }).pipe(provide),

      issue_document: ({ document, revision }) =>
        Effect.gen(function* () {
          const workspace = yield* snapshot;
          const invoice = yield* find(workspace, document);
          if (invoice.status === 'draft') {
            const blockers = issueErrors(invoice.data);
            if (blockers.length)
              return yield* fail(
                `The draft cannot be issued yet: ${blockers.map((issue) => issue.message).join(' ')}`,
              );
            // The same key the invoice pages use, so a retry from either
            // side returns the first issue instead of a second number.
            yield* run({
              action: 'issue',
              id: invoice.id,
              revision,
              key: `issue:${invoice.id}:${revision}`,
            });
          }
          return yield* reread(invoice.id);
        }).pipe(provide),

      delete_draft: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* draft(yield* snapshot, document);
          yield* run({ action: 'remove', id: invoice.id });
          return { ok: true as const };
        }).pipe(provide),

      rectify_invoice: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const made = yield* run({ action: 'rectify', id: invoice.id });
          return yield* reread(made ?? invoice.id);
        }).pipe(provide),

      record_payment: ({ document, amount, date, method, reference }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const payment = {
            id: RecordId.make(crypto.randomUUID()),
            invoiceId: invoice.id,
            amount,
            date,
            method,
            reference: reference ?? '',
            createdAt: new Date().toISOString(),
            reversedAt: null,
          };
          yield* run({ action: 'payment', payment });
          const after = yield* snapshot;
          return {
            payment,
            outstanding: row(invoice, after).outstanding,
          };
        }).pipe(provide),

      reverse_payment: ({ payment }) =>
        Effect.as(
          run({ action: 'reverse-payment', id: RecordId.make(payment) }).pipe(
            provide,
          ),
          { ok: true as const },
        ),

      set_payment_plans: ({ document, plans }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          yield* run({ action: 'offer', id: invoice.id, plans });
          return { ok: true as const };
        }).pipe(provide),

      choose_payment_plan: ({ document, plan }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          yield* run({ action: 'choose', id: invoice.id, plan });
          return { ok: true as const };
        }).pipe(provide),

      save_plan_library: ({ library }) =>
        Effect.as(run({ action: 'library', library }).pipe(provide), {
          ok: true as const,
        }),

      save_customer: ({ customer }) =>
        Effect.gen(function* () {
          const saved = {
            ...customer,
            id: RecordId.make(customer.id ?? crypto.randomUUID()),
          };
          yield* run({ action: 'customer', customer: saved });
          return { customer: saved };
        }).pipe(provide),

      forget_customer: ({ customer }) =>
        Effect.as(
          run({
            action: 'forget',
            kind: 'customer',
            id: RecordId.make(customer),
          }).pipe(provide),
          { ok: true as const },
        ),

      save_catalog_item: ({ item }) =>
        Effect.gen(function* () {
          const { name, ...line } = item;
          const workspace = yield* snapshot;
          const saved = {
            ...lineFrom(line, workspace.items),
            name,
          };
          yield* run({ action: 'item', item: saved });
          return { item: saved };
        }).pipe(provide),

      forget_catalog_item: ({ item }) =>
        Effect.as(
          run({ action: 'forget', kind: 'item', id: RecordId.make(item) }).pipe(
            provide,
          ),
          { ok: true as const },
        ),

      save_settings: ({ preferences }) =>
        Effect.as(run({ action: 'preferences', preferences }).pipe(provide), {
          ok: true as const,
        }),

      revise_quote: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const made = yield* run({ action: 'revise', id: invoice.id });
          return yield* reread(made ?? invoice.id);
        }).pipe(provide),

      bill_quote_payment: ({ document, payment }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const made = yield* run({ action: 'bill', id: invoice.id, payment });
          return yield* reread(made ?? invoice.id);
        }).pipe(provide),

      share_payment_link: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const result = yield* shareLink(invoice.id, actor, base);
          if (!result.ok)
            return yield* fail(shareFailureMessage(result.failure));
          // Payment links open for 30 days from today.
          const until = new Date(`${today()}T12:00:00Z`);
          until.setUTCDate(until.getUTCDate() + 30);
          return { url: result.url, expiresAt: until.toISOString() };
        }).pipe(Effect.provide(online)),

      close_payment_links: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const count = yield* revokeLinks(invoice.id, actor).pipe(
            Effect.catchTag('Refused', ({ message }) => fail(message)),
          );
          return { closed: count };
        }).pipe(Effect.provide(online)),

      send_quote: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          const result = yield* sendQuote(invoice.id, actor, base).pipe(
            Effect.catchTag('Refused', ({ message }) => fail(message)),
          );
          if (!result.ok)
            return yield* fail(
              closed[result.reason] ?? 'The quote cannot be sent.',
            );
          return { url: result.url, expiresAt: result.expiresAt };
        }).pipe(provide),

      close_quote_links: ({ document }) =>
        Effect.gen(function* () {
          const invoice = yield* find(yield* snapshot, document);
          return {
            closed: yield* explained(quotes.revoke(invoice.id, actor)),
          };
        }),
    });
  }),
);

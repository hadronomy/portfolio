import Decimal from 'decimal.js';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { balance, calculate } from './calculate';
import { InvoiceDatabase } from './database';
import {
  type Actor,
  CatalogItem,
  Customer,
  defaultPreferences,
  InvalidInvoice,
  Invoice,
  type InvoiceData,
  type InvoiceId,
  MissingInvoice,
  newInvoice,
  type OwnerDid,
  Payment,
  Preferences,
  QuoteResponse,
  RecordId,
  RevisionConflict,
  type StorageFailure,
} from './model';
import {
  defaultsFor,
  InvoiceOffer,
  noOffer,
  type Offer,
  PlanLibrary,
} from './plan';
import { decodeStored, stored } from './storage';
import * as tables from './tables';
import { issueErrors } from './validate';

/** Failures a store method can return. Callers match on `_tag` to render field errors, reload on conflict, or retry on storage faults. */
export type StoreError =
  | InvalidInvoice
  | MissingInvoice
  | RevisionConflict
  | StorageFailure;
/** Everything the workspace UI needs in one snapshot: documents, directory entries, payments, and issuer defaults. */
export interface Workspace {
  readonly invoices: readonly Invoice[];
  readonly customers: readonly Customer[];
  readonly items: readonly CatalogItem[];
  readonly payments: readonly Payment[];
  /**
   * The plans each invoice offers, by invoice ID. A draft missing here
   * offers the library's defaults; an issued invoice, one payment in full.
   */
  readonly offers: Readonly<Record<string, InvoiceOffer>>;
  /** The plans the owner keeps for reuse, and which are defaults. */
  readonly library: PlanLibrary;
  /** Customers' answers to issued quotes, by quote ID. */
  readonly responses: Readonly<Record<string, QuoteResponse>>;
  readonly preferences: Preferences;
}
/** Persistent invoice workspace: documents, directory, payments, payment plans, and preferences. */
export interface StoreApi {
  /** Reads the whole workspace snapshot for the UI. */
  readonly workspace: () => Effect.Effect<Workspace, StoreError>;
  /** Invoices. */
  readonly save: (
    invoice: Invoice,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, StoreError>;
  /** Issues a draft. Retrying with the same idempotency key returns the first result. */
  readonly issue: (
    input: { id: InvoiceId; revision: number; key: string },
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, StoreError>;
  /** Deletes a draft. Issued documents are kept. */
  readonly remove: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<void, StoreError>;
  /** Directory. */
  readonly customer: (
    customer: Customer,
  ) => Effect.Effect<Customer, StoreError>;
  readonly item: (item: CatalogItem) => Effect.Effect<CatalogItem, StoreError>;
  /** Removes a directory entry. Invoice snapshots keep their copied data. */
  readonly forget: (
    kind: 'customer' | 'item',
    id: RecordId,
  ) => Effect.Effect<void, StoreError>;
  /** Replaces the issuer defaults used for new drafts. */
  readonly preferences: (
    preferences: Preferences,
  ) => Effect.Effect<Preferences, StoreError>;
  /** Payments. Recording the same payment ID twice returns the first record. */
  readonly payment: (
    payment: Payment,
    actor: Actor,
  ) => Effect.Effect<Payment, StoreError>;
  /** The payments recorded against one invoice, reversed ones included. */
  readonly payments: (
    invoice: InvoiceId,
  ) => Effect.Effect<readonly Payment[], StoreError>;
  /** Marks a payment reversed. Missing or already-reversed payments are no-ops. */
  readonly reversePayment: (
    id: RecordId,
    actor: Actor,
  ) => Effect.Effect<void, StoreError>;
  /** Creates a rectifying draft with negated lines for an issued invoice. */
  readonly rectify: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, StoreError>;
  /** Reads one invoice by id. */
  readonly read: (id: InvoiceId) => Effect.Effect<Invoice, StoreError>;
  /** The plans the invoice offers: one payment in full unless the owner set others. */
  readonly offer: (id: InvoiceId) => Effect.Effect<InvoiceOffer, StoreError>;
  /**
   * Replaces the plans the invoice offers, drafts and issued invoices alike:
   * plans are how the customer pays, not part of the document. Null drops
   * the invoice's own plans: a draft goes back to the defaults, an issued
   * invoice to one payment in full. The customer's choice stays while the
   * plan they chose is still offered.
   */
  readonly setOffer: (
    id: InvoiceId,
    plans: Offer | null,
    actor: OwnerDid,
  ) => Effect.Effect<InvoiceOffer | null, StoreError>;
  /** Records the plan the customer pays under, or clears it. */
  readonly choose: (
    id: InvoiceId,
    plan: RecordId | null,
    actor: Actor,
  ) => Effect.Effect<void, StoreError>;
  /** Replaces the library of plans the owner keeps. Invoices keep the copies they took. */
  readonly setLibrary: (
    library: PlanLibrary,
  ) => Effect.Effect<PlanLibrary, StoreError>;
}
/** Effect service tag for the invoice store. */
export class InvoiceStore extends Context.Service<InvoiceStore, StoreApi>()(
  'InvoiceStore',
) {}

const invalid = (path: string, message: string) =>
  new InvalidInvoice({ issues: [{ path, message }] });
const decodeInvoice = decodeStored(Invoice);
const decodePayment = decodeStored(Payment);
const decodeOffer = decodeStored(InvoiceOffer);
const decodeLibrary = decodeStored(PlanLibrary);

/** Builds the store over the invoice database. The idempotency-key and revision-conflict paths below are load-bearing; keep their behavior. */
export const makeStore = Effect.gen(function* () {
  const db = yield* InvoiceDatabase;

  const read = (id: InvoiceId) =>
    Effect.gen(function* () {
      const row = yield* db.query.invoices.findFirst({ where: { id } });
      if (!row) return yield* new MissingInvoice({ id });
      return yield* decodeInvoice(row.payload);
    });

  const writeRecord = (kind: string, key: string, payload: unknown) =>
    db
      .insert(tables.records)
      .values({ kind, key, payload })
      .onConflictDoUpdate({ target: tables.records.key, set: { payload } });

  const api: StoreApi = {
    workspace: Effect.fn('InvoiceStore.workspace')(function* () {
      const [invoices, records, offers, responses] = yield* Effect.all([
        db
          .select()
          .from(tables.invoices)
          .orderBy(desc(tables.invoices.updatedAt)),
        db.select().from(tables.records),
        db.select().from(tables.offers),
        db.select().from(tables.responses),
      ]);
      const of = <A>(
        kind: string,
        decode: (payload: unknown) => Effect.Effect<A, StorageFailure>,
      ) =>
        Effect.forEach(
          records.filter((row) => row.kind === kind),
          (row) => decode(row.payload),
        );
      const preferences = records.find((row) => row.key === 'preferences');
      const library = records.find((row) => row.key === 'plan-library');
      return {
        invoices: yield* Effect.forEach(invoices, (row) =>
          decodeInvoice(row.payload),
        ),
        customers: yield* of('customer', decodeStored(Customer)),
        items: yield* of('item', decodeStored(CatalogItem)),
        payments: yield* of('payment', decodePayment),
        offers: Object.fromEntries(
          yield* Effect.forEach(offers, (row) =>
            Effect.map(
              decodeOffer({ plans: row.plans, chosen: row.chosen }),
              (offer) => [row.invoiceId, offer],
            ),
          ),
        ),
        library: library ? yield* decodeLibrary(library.payload) : [],
        responses: Object.fromEntries(
          yield* Effect.forEach(responses, (row) =>
            Effect.map(decodeStored(QuoteResponse)(row), (response) => [
              row.quoteId,
              response,
            ]),
          ),
        ),
        preferences: preferences
          ? yield* decodeStored(Preferences)(preferences.payload)
          : defaultPreferences,
      };
    }, stored),

    read: Effect.fn('InvoiceStore.read')(read, stored),

    offer: Effect.fn('InvoiceStore.offer')(function* (id: InvoiceId) {
      const [row] = yield* db
        .select()
        .from(tables.offers)
        .where(eq(tables.offers.invoiceId, id));
      return row
        ? yield* decodeOffer({ plans: row.plans, chosen: row.chosen })
        : noOffer;
    }, stored),

    setOffer: Effect.fn('InvoiceStore.setOffer')(function* (
      id: InvoiceId,
      plans: Offer | null,
      actor: OwnerDid,
    ) {
      const invoice = yield* read(id);
      if (plans && invoice.data.kind !== 'invoice')
        return yield* invalid(
          'offer',
          'Only an invoice can offer payment plans.',
        );
      const now = new Date().toISOString();
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [row] = yield* tx
            .select({ chosen: tables.offers.chosen })
            .from(tables.offers)
            .where(eq(tables.offers.invoiceId, id))
            .for('update');
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation: 'offer-changed',
            actor,
            payload: { plans },
            createdAt: now,
          });
          if (!plans) {
            yield* tx
              .delete(tables.offers)
              .where(eq(tables.offers.invoiceId, id));
            return null;
          }
          const chosen =
            plans.find((plan) => plan.id === row?.chosen)?.id ?? null;
          yield* tx
            .insert(tables.offers)
            .values({ invoiceId: id, plans, chosen, updatedAt: now })
            .onConflictDoUpdate({
              target: tables.offers.invoiceId,
              set: { plans, chosen, updatedAt: now },
            });
          return { plans, chosen };
        }),
      );
    }, stored),

    choose: Effect.fn('InvoiceStore.choose')(function* (
      id: InvoiceId,
      plan: RecordId | null,
      actor: Actor,
    ) {
      const [row] = yield* db
        .select()
        .from(tables.offers)
        .where(eq(tables.offers.invoiceId, id));
      if (!row || row.chosen === plan) return;
      const offer = yield* decodeOffer({ plans: row.plans, chosen: null });
      if (plan && !offer.plans.some((item) => item.id === plan))
        return yield* invalid('plan', 'The invoice does not offer that plan.');
      const now = new Date().toISOString();
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx
            .update(tables.offers)
            .set({ chosen: plan, updatedAt: now })
            .where(eq(tables.offers.invoiceId, id));
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation: 'plan-chosen',
            actor,
            payload: { plan },
            createdAt: now,
          });
        }),
      );
    }, stored),

    setLibrary: Effect.fn('InvoiceStore.setLibrary')(function* (
      library: PlanLibrary,
    ) {
      yield* writeRecord('plan-library', 'plan-library', library);
      return library;
    }, stored),

    save: Effect.fn('InvoiceStore.save')(function* (
      input: Invoice,
      actor: OwnerDid,
    ) {
      if (input.status !== 'draft' || input.number || input.issuedAt)
        return yield* invalid('status', 'Issued invoices cannot be edited.');
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [row] = yield* tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, input.id))
            .for('update');
          const current = row ? yield* decodeInvoice(row.payload) : null;
          if (current?.status === 'issued')
            return yield* invalid(
              'status',
              'Create a rectifying invoice to change an issued invoice.',
            );
          if (current && current.revision !== input.revision)
            return yield* new RevisionConflict({ current });
          const now = new Date().toISOString();
          const saved: Invoice = {
            ...input,
            revision: current ? current.revision + 1 : 1,
            createdAt: current?.createdAt ?? now,
            updatedAt: now,
          };
          yield* tx
            .insert(tables.invoices)
            .values({
              id: saved.id,
              status: saved.status,
              revision: saved.revision,
              payload: saved,
              updatedAt: saved.updatedAt,
            })
            .onConflictDoUpdate({
              target: tables.invoices.id,
              set: {
                revision: saved.revision,
                payload: saved,
                updatedAt: saved.updatedAt,
              },
            });
          if (!current)
            yield* tx.insert(tables.audit).values({
              id: crypto.randomUUID(),
              invoiceId: saved.id,
              operation: 'created',
              actor,
              payload: { revision: saved.revision },
              createdAt: saved.updatedAt,
            });
          return saved;
        }),
      );
    }, stored),

    issue: Effect.fn('InvoiceStore.issue')(function* (
      input: { id: InvoiceId; revision: number; key: string },
      actor: OwnerDid,
    ) {
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [prior] = yield* tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.issueKey, input.key));
          if (prior) {
            if (prior.id !== input.id)
              return yield* invalid(
                'key',
                'This issue request belongs to another invoice.',
              );
            return yield* decodeInvoice(prior.payload);
          }
          const [row] = yield* tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, input.id))
            .for('update');
          if (!row) return yield* new MissingInvoice({ id: input.id });
          const draft = yield* decodeInvoice(row.payload);
          if (draft.status === 'issued') return draft;
          if (draft.revision !== input.revision)
            return yield* new RevisionConflict({ current: draft });
          const issues = issueErrors(draft.data);
          if (issues.length) return yield* new InvalidInvoice({ issues });
          const d = draft.data;
          const year = d.issueDate.slice(0, 4);
          const prefix =
            d.kind === 'invoice'
              ? d.series
              : `${d.kind === 'rectification' ? 'R' : 'P'}-${d.series}`;
          const key = `${d.issuer.taxId}/${prefix}/${year}`;
          const [sequence] = yield* tx
            .insert(tables.sequences)
            .values({ key, value: 1, lastDate: d.issueDate })
            .onConflictDoUpdate({
              target: tables.sequences.key,
              set: { value: sql`${tables.sequences.value} + 1` },
            })
            .returning();
          if (!sequence)
            return yield* invalid(
              'number',
              'Could not allocate an invoice number.',
            );
          if (sequence.lastDate > d.issueDate)
            return yield* invalid(
              'issueDate',
              'This series already contains a later issue date.',
            );
          yield* tx
            .update(tables.sequences)
            .set({ lastDate: d.issueDate })
            .where(eq(tables.sequences.key, key));
          const now = new Date().toISOString();
          const issued: Invoice = {
            ...draft,
            status: 'issued',
            number: `${prefix}-${year}-${String(sequence.value).padStart(4, '0')}`,
            issuedAt: now,
            updatedAt: now,
            revision: draft.revision + 1,
          };
          yield* tx
            .update(tables.invoices)
            .set({
              status: 'issued',
              number: issued.number,
              issueKey: input.key,
              revision: issued.revision,
              payload: issued,
              updatedAt: issued.updatedAt,
            })
            .where(eq(tables.invoices.id, input.id));
          const totals = calculate(issued.data);
          // An invoice issued without plans of its own takes a copy of the
          // defaults that suit its total, so later changes to the library
          // never move what a customer was already offered.
          const [own] = yield* tx
            .select({ invoiceId: tables.offers.invoiceId })
            .from(tables.offers)
            .where(eq(tables.offers.invoiceId, issued.id));
          const [kept] = yield* tx
            .select()
            .from(tables.records)
            .where(eq(tables.records.key, 'plan-library'));
          const defaults =
            !own && kept && d.kind === 'invoice'
              ? defaultsFor(yield* decodeLibrary(kept.payload), totals.total)
              : [];
          if (defaults.length)
            yield* tx.insert(tables.offers).values({
              invoiceId: issued.id,
              plans: defaults,
              chosen: null,
              updatedAt: now,
            });
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: issued.id,
            operation: 'issued',
            actor,
            payload: {
              number: issued.number,
              revision: issued.revision,
              totals,
              ...(defaults.length ? { plans: defaults } : {}),
            },
            createdAt: issued.updatedAt,
          });
          return issued;
        }),
      );
    }, stored),

    remove: Effect.fn('InvoiceStore.remove')(function* (
      id: InvoiceId,
      actor: OwnerDid,
    ) {
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [row] = yield* tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, id))
            .for('update');
          if (!row) return;
          if (row.status !== 'draft')
            return yield* invalid(
              'status',
              'Issued invoices cannot be deleted.',
            );
          yield* tx.delete(tables.invoices).where(eq(tables.invoices.id, id));
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation: 'draft-deleted',
            actor,
            payload: {},
            createdAt: new Date().toISOString(),
          });
        }),
      );
    }, stored),

    customer: Effect.fn('InvoiceStore.customer')(function* (
      customer: Customer,
    ) {
      yield* writeRecord('customer', customer.id, customer);
      return customer;
    }, stored),

    item: Effect.fn('InvoiceStore.item')(function* (item: CatalogItem) {
      yield* writeRecord('item', item.id, item);
      return item;
    }, stored),

    forget: Effect.fn('InvoiceStore.forget')(function* (
      kind: 'customer' | 'item',
      id: RecordId,
    ) {
      yield* db
        .delete(tables.records)
        .where(and(eq(tables.records.kind, kind), eq(tables.records.key, id)));
    }, stored),

    preferences: Effect.fn('InvoiceStore.preferences')(function* (
      preferences: Preferences,
    ) {
      yield* writeRecord('preferences', 'preferences', preferences);
      return preferences;
    }, stored),

    payment: Effect.fn('InvoiceStore.payment')(function* (
      value: Payment,
      actor: Actor,
    ) {
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [row] = yield* tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, value.invoiceId))
            .for('update');
          if (!row) return yield* new MissingInvoice({ id: value.invoiceId });
          const invoice = yield* decodeInvoice(row.payload);
          if (invoice.status !== 'issued' || invoice.data.kind === 'quote')
            return yield* invalid(
              'payment',
              'Payments require an issued invoice.',
            );
          const [existing] = yield* tx
            .select()
            .from(tables.records)
            .where(eq(tables.records.key, value.id));
          if (existing) return yield* decodePayment(existing.payload);
          const rows = yield* tx
            .select()
            .from(tables.records)
            .where(
              and(
                eq(tables.records.kind, 'payment'),
                sql`${tables.records.payload}->>'invoiceId' = ${value.invoiceId}`,
              ),
            );
          const payments = yield* Effect.forEach(rows, (record) =>
            decodePayment(record.payload),
          );
          const remaining = balance(calculate(invoice.data).total, payments);
          const amount = new Decimal(value.amount);
          if (amount.isZero() || amount.isNegative() || amount.gt(remaining))
            return yield* invalid(
              'amount',
              'Enter an amount between zero and the outstanding balance.',
            );
          const saved: Payment = {
            ...value,
            createdAt: new Date().toISOString(),
            reversedAt: null,
          };
          yield* tx
            .insert(tables.records)
            .values({ kind: 'payment', key: saved.id, payload: saved });
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            operation: 'payment-recorded',
            actor,
            payload: saved,
            createdAt: saved.createdAt,
          });
          return saved;
        }),
      );
    }, stored),

    payments: Effect.fn('InvoiceStore.payments')(function* (
      invoice: InvoiceId,
    ) {
      const rows = yield* db
        .select()
        .from(tables.records)
        .where(
          and(
            eq(tables.records.kind, 'payment'),
            sql`${tables.records.payload}->>'invoiceId' = ${invoice}`,
          ),
        );
      return yield* Effect.forEach(rows, (row) => decodePayment(row.payload));
    }, stored),

    reversePayment: Effect.fn('InvoiceStore.reversePayment')(function* (
      id: RecordId,
      actor: Actor,
    ) {
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const [record] = yield* tx
            .select()
            .from(tables.records)
            .where(
              and(
                eq(tables.records.key, id),
                eq(tables.records.kind, 'payment'),
              ),
            )
            .for('update');
          if (!record) return;
          const current = yield* decodePayment(record.payload);
          if (current.reversedAt) return;
          const reversedAt = new Date().toISOString();
          yield* tx
            .update(tables.records)
            .set({ payload: { ...current, reversedAt } })
            .where(eq(tables.records.key, id));
          yield* tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: current.invoiceId,
            operation: 'payment-reversed',
            actor,
            payload: { id },
            createdAt: reversedAt,
          });
        }),
      );
    }, stored),

    rectify: Effect.fn('InvoiceStore.rectify')(function* (
      id: InvoiceId,
      actor: OwnerDid,
    ) {
      const original = yield* read(id);
      if (original.status !== 'issued' || original.data.kind === 'quote')
        return yield* invalid(
          'correction',
          'Select an issued invoice to rectify.',
        );
      const draft = newInvoice();
      const data: InvoiceData = {
        ...original.data,
        kind: 'rectification',
        issueDate: draft.data.issueDate,
        supplyDate: original.data.supplyDate,
        dueDate: draft.data.dueDate,
        correction: {
          invoiceId: original.id,
          number: original.number ?? '',
          reason: '',
        },
        lines: original.data.lines.map((line) => ({
          ...line,
          id: RecordId.make(crypto.randomUUID()),
          quantity: new Decimal(line.quantity).negated().toString(),
        })),
      };
      const next: Invoice = { ...draft, data };
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
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
            operation: 'rectification-created',
            actor,
            payload: { originalId: id },
            createdAt: next.createdAt,
          });
        }),
      );
      return next;
    }, stored),
  };
  return InvoiceStore.of(api);
});

/** The store over the invoice database. */
export const storeLayer = Layer.effect(InvoiceStore, makeStore);

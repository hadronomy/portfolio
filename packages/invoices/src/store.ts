import Decimal from 'decimal.js';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { balance, calculate } from './calculate';
import { type Database, type DatabaseOptions, openDatabase } from './database';
import {
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
  RecordId,
  RevisionConflict,
  StorageFailure,
} from './model';
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
  readonly preferences: Preferences;
}
/** Persistent invoice workspace. Eleven methods cover documents, directory, payments, and preferences. */
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
  /** Payments. */
  readonly payment: (
    payment: Payment,
    actor: OwnerDid,
  ) => Effect.Effect<Payment, StoreError>;
  /** Marks a payment reversed. Missing or already-reversed payments are no-ops. */
  readonly reversePayment: (
    id: RecordId,
    actor: OwnerDid,
  ) => Effect.Effect<void, StoreError>;
  /** Creates a rectifying draft with negated lines for an issued invoice. */
  readonly rectify: (
    id: InvoiceId,
    actor: OwnerDid,
  ) => Effect.Effect<Invoice, StoreError>;
  /** Reads one invoice by id. */
  readonly read: (id: InvoiceId) => Effect.Effect<Invoice, StoreError>;
}
/** Effect service tag for the invoice store. */
export class InvoiceStore extends Context.Service<InvoiceStore, StoreApi>()(
  'InvoiceStore',
) {}
const failure = (error: unknown): StoreError =>
  error instanceof InvalidInvoice ||
  error instanceof MissingInvoice ||
  error instanceof RevisionConflict
    ? error
    : new StorageFailure({ message: 'The database operation failed.' });
const operation = <A>(name: string, run: () => Promise<A>) =>
  Effect.fn(name)(() => Effect.tryPromise({ try: run, catch: failure }))();
const invalid = (path: string, message: string) =>
  new InvalidInvoice({ issues: [{ path, message }] });
const decodeInvoice = Schema.decodeUnknownSync(Invoice);

/** Builds the store over an open database. The idempotency-key and revision-conflict paths below are load-bearing; keep their behavior. */
export function makeStore({ db }: Database): StoreApi {
  const read = async (id: InvoiceId) => {
    const [row] = await db
      .select()
      .from(tables.invoices)
      .where(eq(tables.invoices.id, id));
    if (!row) throw new MissingInvoice({ id });
    return decodeInvoice(row.payload);
  };
  const writeRecord = async (kind: string, key: string, payload: unknown) => {
    await db
      .insert(tables.records)
      .values({ kind, key, payload })
      .onConflictDoUpdate({ target: tables.records.key, set: { payload } });
  };
  return {
    workspace: () =>
      operation('InvoiceStore.workspace', async () => {
        const [invoices, records] = await Promise.all([
          db
            .select()
            .from(tables.invoices)
            .orderBy(desc(tables.invoices.updatedAt)),
          db.select().from(tables.records),
        ]);
        const preferences = records.find((row) => row.key === 'preferences');
        return {
          invoices: invoices.map((row) => decodeInvoice(row.payload)),
          customers: records
            .filter((row) => row.kind === 'customer')
            .map((row) => Schema.decodeUnknownSync(Customer)(row.payload)),
          items: records
            .filter((row) => row.kind === 'item')
            .map((row) => Schema.decodeUnknownSync(CatalogItem)(row.payload)),
          payments: records
            .filter((row) => row.kind === 'payment')
            .map((row) => Schema.decodeUnknownSync(Payment)(row.payload)),
          preferences: preferences
            ? Schema.decodeUnknownSync(Preferences)(preferences.payload)
            : defaultPreferences,
        };
      }),
    read: (id) => operation('InvoiceStore.read', () => read(id)),
    save: (invoice, actor) =>
      operation('InvoiceStore.save', async () => {
        const input = decodeInvoice(invoice);
        if (input.status !== 'draft' || input.number || input.issuedAt)
          throw invalid('status', 'Issued invoices cannot be edited.');
        return db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, input.id))
            .for('update');
          const current = row ? decodeInvoice(row.payload) : null;
          if (current?.status === 'issued')
            throw invalid(
              'status',
              'Create a rectifying invoice to change an issued invoice.',
            );
          if (current && current.revision !== input.revision)
            throw new RevisionConflict({ current });
          const saved = {
            ...input,
            revision: current ? current.revision + 1 : 1,
            createdAt: current?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await tx
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
            await tx.insert(tables.audit).values({
              id: crypto.randomUUID(),
              invoiceId: saved.id,
              operation: 'created',
              actor,
              payload: { revision: saved.revision },
              createdAt: saved.updatedAt,
            });
          return saved;
        });
      }),
    issue: (input, actor) =>
      operation('InvoiceStore.issue', () =>
        db.transaction(async (tx) => {
          const [prior] = await tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.issueKey, input.key));
          if (prior) {
            if (prior.id !== input.id)
              throw invalid(
                'key',
                'This issue request belongs to another invoice.',
              );
            return decodeInvoice(prior.payload);
          }
          const [row] = await tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, input.id))
            .for('update');
          if (!row) throw new MissingInvoice({ id: input.id });
          const draft = decodeInvoice(row.payload);
          if (draft.status === 'issued') return draft;
          if (draft.revision !== input.revision)
            throw new RevisionConflict({ current: draft });
          const issues = issueErrors(draft.data);
          if (issues.length) throw new InvalidInvoice({ issues });
          const d = draft.data;
          const year = d.issueDate.slice(0, 4);
          const prefix =
            d.kind === 'invoice'
              ? d.series
              : `${d.kind === 'rectification' ? 'R' : 'P'}-${d.series}`;
          const key = `${d.issuer.taxId}/${prefix}/${year}`;
          const [sequence] = await tx
            .insert(tables.sequences)
            .values({ key, value: 1, lastDate: d.issueDate })
            .onConflictDoUpdate({
              target: tables.sequences.key,
              set: { value: sql`${tables.sequences.value} + 1` },
            })
            .returning();
          if (!sequence)
            throw invalid('number', 'Could not allocate an invoice number.');
          if (sequence.lastDate > d.issueDate)
            throw invalid(
              'issueDate',
              'This series already contains a later issue date.',
            );
          await tx
            .update(tables.sequences)
            .set({ lastDate: d.issueDate })
            .where(eq(tables.sequences.key, key));
          const issued: Invoice = {
            ...draft,
            status: 'issued',
            number: `${prefix}-${year}-${String(sequence.value).padStart(4, '0')}`,
            issuedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            revision: draft.revision + 1,
          };
          await tx
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
          await tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: issued.id,
            operation: 'issued',
            actor,
            payload: {
              number: issued.number,
              revision: issued.revision,
              totals: calculate(issued.data),
            },
            createdAt: issued.updatedAt,
          });
          return issued;
        }),
      ),
    remove: (id, actor) =>
      operation('InvoiceStore.remove', async () => {
        await db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, id))
            .for('update');
          if (!row) return;
          if (row.status !== 'draft')
            throw invalid('status', 'Issued invoices cannot be deleted.');
          await tx.delete(tables.invoices).where(eq(tables.invoices.id, id));
          await tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: id,
            operation: 'draft-deleted',
            actor,
            payload: {},
            createdAt: new Date().toISOString(),
          });
        });
      }),
    customer: (customer) =>
      operation('InvoiceStore.customer', async () => {
        const value = Schema.decodeUnknownSync(Customer)(customer);
        await writeRecord('customer', value.id, value);
        return value;
      }),
    item: (item) =>
      operation('InvoiceStore.item', async () => {
        const value = Schema.decodeUnknownSync(CatalogItem)(item);
        await writeRecord('item', value.id, value);
        return value;
      }),
    forget: (kind, id) =>
      operation('InvoiceStore.forget', async () => {
        await db
          .delete(tables.records)
          .where(
            and(eq(tables.records.kind, kind), eq(tables.records.key, id)),
          );
      }),
    preferences: (preferences) =>
      operation('InvoiceStore.preferences', async () => {
        const value = Schema.decodeUnknownSync(Preferences)(preferences);
        await writeRecord('preferences', 'preferences', value);
        return value;
      }),
    payment: (payment, actor) =>
      operation('InvoiceStore.payment', () =>
        db.transaction(async (tx) => {
          const value = Schema.decodeUnknownSync(Payment)(payment);
          const [row] = await tx
            .select()
            .from(tables.invoices)
            .where(eq(tables.invoices.id, value.invoiceId))
            .for('update');
          if (!row) throw new MissingInvoice({ id: value.invoiceId });
          const invoice = decodeInvoice(row.payload);
          if (invoice.status !== 'issued' || invoice.data.kind === 'proforma')
            throw invalid('payment', 'Payments require an issued invoice.');
          const [existing] = await tx
            .select()
            .from(tables.records)
            .where(eq(tables.records.key, value.id));
          if (existing)
            return Schema.decodeUnknownSync(Payment)(existing.payload);
          const records = await tx
            .select()
            .from(tables.records)
            .where(eq(tables.records.kind, 'payment'));
          const payments = records
            .map((record) => Schema.decodeUnknownSync(Payment)(record.payload))
            .filter((record) => record.invoiceId === value.invoiceId);
          const remaining = balance(calculate(invoice.data).total, payments);
          if (
            new Decimal(value.amount).isZero() ||
            new Decimal(value.amount).isNegative() ||
            new Decimal(value.amount).gt(remaining)
          )
            throw invalid(
              'amount',
              'Enter an amount between zero and the outstanding balance.',
            );
          const saved = {
            ...value,
            createdAt: new Date().toISOString(),
            reversedAt: null,
          };
          await tx
            .insert(tables.records)
            .values({ kind: 'payment', key: saved.id, payload: saved });
          await tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: invoice.id,
            operation: 'payment-recorded',
            actor,
            payload: saved,
            createdAt: saved.createdAt,
          });
          return saved;
        }),
      ),
    reversePayment: (id, actor) =>
      operation('InvoiceStore.reversePayment', async () => {
        await db.transaction(async (tx) => {
          const [record] = await tx
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
          const current = Schema.decodeUnknownSync(Payment)(record.payload);
          if (current.reversedAt) return;
          const reversedAt = new Date().toISOString();
          await tx
            .update(tables.records)
            .set({ payload: { ...current, reversedAt } })
            .where(eq(tables.records.key, id));
          await tx.insert(tables.audit).values({
            id: crypto.randomUUID(),
            invoiceId: current.invoiceId,
            operation: 'payment-reversed',
            actor,
            payload: { id },
            createdAt: reversedAt,
          });
        });
      }),
    rectify: (id, actor) =>
      operation('InvoiceStore.rectify', async () => {
        const original = await read(id);
        if (original.status !== 'issued' || original.data.kind === 'proforma')
          throw invalid('correction', 'Select an issued invoice to rectify.');
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
        const next = { ...draft, data };
        await db.insert(tables.invoices).values({
          id: next.id,
          status: 'draft',
          revision: 1,
          payload: next,
          updatedAt: next.updatedAt,
        });
        await db.insert(tables.audit).values({
          id: crypto.randomUUID(),
          invoiceId: next.id,
          operation: 'rectification-created',
          actor,
          payload: { originalId: id },
          createdAt: next.createdAt,
        });
        return next;
      }),
  };
}

/** Serves the store with managed database open and close. */
export const storeLayer = (options: DatabaseOptions) =>
  Layer.effect(
    InvoiceStore,
    Effect.gen(function* () {
      const database = yield* Effect.acquireRelease(
        Effect.tryPromise({ try: () => openDatabase(options), catch: failure }),
        (db) => Effect.promise(() => db.close()),
      );
      return InvoiceStore.of(makeStore(database));
    }),
  );

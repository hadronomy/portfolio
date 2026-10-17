import Decimal from 'decimal.js';
import { and, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { Context, Effect, Layer, Schema } from 'effect';
import { balance, calculate } from '#calculate';
import { InvoiceDatabase } from '#database';
import {
  Cover,
  Currency,
  DateText,
  DecimalText,
  Invoice,
  InvoiceId,
  Language,
  MissingInvoice,
  Payment,
  type StorageFailure,
} from '#model';
import { effective, InvoiceOffer, noOffer, schedule, termsOf } from '#plan';
import { decodeStored, stored } from '#storage';
import * as tables from '#tables';

// What a customer sees once they sign in. A customer is known by the address
// their invoices are billed to: proving they read that inbox opens every
// issued invoice addressed to it, and nothing else in the workspace. The
// payment link stays the way in: an address may open an account only while
// one of its invoices has a link open.

/** The address an invoice is billed to, trimmed and lower-cased so it compares as mail servers do. */
export const CustomerEmail = Schema.String.pipe(Schema.brand('CustomerEmail'));
export type CustomerEmail = typeof CustomerEmail.Type;

/** Normalizes a typed or stored address into the form invoices are matched on. */
export const customerEmail = (address: string): CustomerEmail =>
  CustomerEmail.make(address.trim().toLowerCase());

/** One invoice in a customer's list: enough to recognise it and see what is owed. */
export const CustomerInvoice = Schema.Struct({
  id: InvoiceId,
  number: Schema.String,
  title: Schema.String,
  issuer: Schema.String,
  issueDate: Schema.String,
  dueDate: Schema.String,
  language: Language,
  currency: Currency,
  cover: Cover,
  total: DecimalText,
  /** What is still owed after every payment that was not reversed. */
  remaining: DecimalText,
  /**
   * The next payment the invoice's plan asks for: what is left of it, when,
   * and which of how many it is. Null once nothing is owed.
   */
  next: Schema.NullOr(
    Schema.Struct({
      amount: DecimalText,
      date: DateText,
      late: Schema.Boolean,
      index: Schema.Int,
      of: Schema.Int,
    }),
  ),
});
export interface CustomerInvoice
  extends Schema.Schema.Type<typeof CustomerInvoice> {}

export interface CustomerAccessApi {
  /** Whether `email` may open an account: an issued invoice billed to it has a payment link open now. */
  readonly admits: (
    email: CustomerEmail,
  ) => Effect.Effect<boolean, StorageFailure>;
  /** Every issued invoice billed to `email`, newest first. */
  readonly invoices: (
    email: CustomerEmail,
  ) => Effect.Effect<readonly CustomerInvoice[], StorageFailure>;
  /** One issued invoice, if it is billed to `email`; any other reads as missing. */
  readonly invoice: (
    email: CustomerEmail,
    id: InvoiceId,
  ) => Effect.Effect<Invoice, MissingInvoice | StorageFailure>;
}

/** The customer's window onto their own invoices. */
export class CustomerAccess extends Context.Service<
  CustomerAccess,
  CustomerAccessApi
>()('CustomerAccess') {}

const decodeInvoice = decodeStored(Invoice);
const decodePayment = decodeStored(Payment);
const decodeOffer = decodeStored(InvoiceOffer);

/** The first instalment not yet paid under the plan that applies, as the list shows it. */
function nextOf(
  invoice: Invoice,
  offer: InvoiceOffer,
  total: string,
  remaining: string,
): CustomerInvoice['next'] {
  if (!new Decimal(remaining).gt(0)) return null;
  const paid = new Decimal(total).minus(remaining).toFixed(2);
  const today = new Date().toISOString().slice(0, 10);
  const terms = termsOf(invoice, total);
  const plan = effective(offer.plans, terms, offer.chosen);
  const { instalments } = schedule(plan, terms, paid, today);
  const index = instalments.findIndex((part) => part.state !== 'paid');
  const part = instalments[index];
  if (!part) return null;
  return {
    amount: new Decimal(part.amount).minus(part.paid).toFixed(2),
    date: part.date,
    late: part.state === 'late',
    index: index + 1,
    of: instalments.length,
  };
}

const billedTo = (email: CustomerEmail) =>
  and(
    eq(tables.invoices.status, 'issued'),
    isNotNull(tables.invoices.number),
    sql`lower(trim(${tables.invoices.payload} #>> '{data,customer,email}')) = ${email}`,
  );

/** Builds customer access over the invoice database. */
export const makeCustomerAccess = Effect.gen(function* () {
  const db = yield* InvoiceDatabase;
  const api: CustomerAccessApi = {
    admits: Effect.fn('CustomerAccess.admits')(function* (
      email: CustomerEmail,
    ) {
      const [open] = yield* db
        .select({ invoiceId: tables.links.invoiceId })
        .from(tables.links)
        .innerJoin(
          tables.invoices,
          eq(tables.invoices.id, tables.links.invoiceId),
        )
        .where(
          and(
            billedTo(email),
            isNull(tables.links.revokedAt),
            gt(tables.links.expiresAt, new Date().toISOString()),
          ),
        )
        .limit(1);
      return !!open;
    }, stored),

    invoices: Effect.fn('CustomerAccess.invoices')(function* (
      email: CustomerEmail,
    ) {
      const rows = yield* db
        .select({ payload: tables.invoices.payload })
        .from(tables.invoices)
        .where(billedTo(email));
      const invoices = yield* Effect.forEach(rows, (row) =>
        decodeInvoice(row.payload),
      );
      if (invoices.length === 0) return [];
      const ids = invoices.map((invoice) => invoice.id);
      const ledger = yield* db
        .select({ payload: tables.records.payload })
        .from(tables.records)
        .where(
          and(
            eq(tables.records.kind, 'payment'),
            inArray(sql`${tables.records.payload} ->> 'invoiceId'`, ids),
          ),
        );
      const payments = yield* Effect.forEach(ledger, (row) =>
        decodePayment(row.payload),
      );
      const offers = new Map<string, InvoiceOffer>(
        yield* Effect.forEach(
          yield* db
            .select()
            .from(tables.offers)
            .where(inArray(tables.offers.invoiceId, ids)),
          (row) =>
            Effect.map(
              decodeOffer({ plans: row.plans, chosen: row.chosen }),
              (offer) => [row.invoiceId, offer] as const,
            ),
        ),
      );
      return invoices
        .map((invoice): CustomerInvoice => {
          const { total } = calculate(invoice.data);
          const remaining = balance(
            total,
            payments.filter((payment) => payment.invoiceId === invoice.id),
          );
          return {
            id: invoice.id,
            number: invoice.number ?? '',
            title: invoice.data.title,
            issuer: invoice.data.issuer.name,
            issueDate: invoice.data.issueDate,
            dueDate: invoice.data.dueDate,
            language: invoice.data.language,
            currency: invoice.data.currency,
            cover: invoice.data.cover,
            total,
            remaining,
            next: nextOf(
              invoice,
              offers.get(invoice.id) ?? noOffer,
              total,
              remaining,
            ),
          };
        })
        .sort(
          (a, b) =>
            b.issueDate.localeCompare(a.issueDate) ||
            b.number.localeCompare(a.number),
        );
    }, stored),

    invoice: Effect.fn('CustomerAccess.invoice')(function* (
      email: CustomerEmail,
      id: InvoiceId,
    ) {
      const [row] = yield* db
        .select({ payload: tables.invoices.payload })
        .from(tables.invoices)
        .where(and(eq(tables.invoices.id, id), billedTo(email)));
      if (!row) return yield* new MissingInvoice({ id });
      return yield* decodeInvoice(row.payload);
    }, stored),
  };
  return CustomerAccess.of(api);
});

/** Customer access over the invoice database. */
export const customerAccessLayer = Layer.effect(
  CustomerAccess,
  makeCustomerAccess,
);

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// The invoice module's tables, in a PostgreSQL schema of their own so they
// sit beside other modules' tables without sharing names or a migration
// history. drizzle-kit generates every migration from this file:
// `bun run --cwd packages/invoices db:generate`.

/** The `invoices` namespace. drizzle.config.ts filters on it. */
export const namespace = pgSchema('invoices');

const at = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' });

/** Invoice documents, drafts and issued, each stored whole as `payload`. */
export const invoices = namespace.table(
  'invoices',
  {
    id: uuid().primaryKey(),
    revision: integer().notNull(),
    status: text({ enum: ['draft', 'issued'] }).notNull(),
    number: text().unique(),
    issueKey: text('issue_key').unique(),
    payload: jsonb().notNull(),
    updatedAt: at('updated_at').notNull(),
  },
  (table) => [
    check('invoices_revision_positive', sql`${table.revision} > 0`),
    check('invoices_status_known', sql`${table.status} in ('draft', 'issued')`),
  ],
);

/** The last number handed out in each series and year. */
export const sequences = namespace.table('sequences', {
  key: text().primaryKey(),
  value: integer().notNull(),
  lastDate: text('last_date').notNull(),
});

/** Directory entries, payments, and preferences, keyed and typed by `kind`. */
export const records = namespace.table(
  'records',
  {
    key: text().primaryKey(),
    kind: text().notNull(),
    payload: jsonb().notNull(),
  },
  (table) => [index('records_kind').on(table.kind)],
);

/** Rendered PDFs, kept so every download of an issued invoice is the same bytes. */
export const artifacts = namespace.table('artifacts', {
  key: text().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  language: text().notNull(),
  digest: text().notNull(),
  bytes: text().notNull(),
  createdAt: at('created_at').notNull(),
});

/** Who changed what, and when. */
export const audit = namespace.table(
  'audit',
  {
    id: uuid().primaryKey(),
    invoiceId: uuid('invoice_id'),
    operation: text().notNull(),
    actor: text().notNull(),
    payload: jsonb().notNull(),
    createdAt: at('created_at').notNull(),
  },
  (table) => [index('audit_invoice').on(table.invoiceId, table.createdAt)],
);

/** One row per invoice put up for payment through Stripe: where its collection stands and the Stripe objects behind it. */
export const collections = namespace.table(
  'collections',
  {
    invoiceId: uuid('invoice_id')
      .primaryKey()
      .references(() => invoices.id),
    customerKey: text('customer_key').notNull(),
    stripeCustomer: text('stripe_customer'),
    stripeInvoice: text('stripe_invoice').unique(),
    state: text({ enum: ['preparing', 'open', 'paid', 'review'] }).notNull(),
    review: jsonb(),
    updatedAt: at('updated_at').notNull(),
  },
  (table) => [
    index('collections_customer').on(table.customerKey),
    check(
      'collections_state_known',
      sql`${table.state} in ('preparing', 'open', 'paid', 'review')`,
    ),
  ],
);

/** Customer payment links. Only a hash of each token is kept, so the table cannot be read back into working links. */
export const links = namespace.table(
  'links',
  {
    tokenHash: text('token_hash').primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    expiresAt: at('expires_at').notNull(),
    revokedAt: at('revoked_at'),
    createdAt: at('created_at').notNull(),
  },
  (table) => [index('links_invoice').on(table.invoiceId)],
);

/**
 * The plans each invoice offers, kept as `plan.ts` writes them, and the one
 * the customer last went to pay under. An invoice with no row offers one
 * payment in full.
 */
export const offers = namespace.table('offers', {
  invoiceId: uuid('invoice_id')
    .primaryKey()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  plans: jsonb().notNull(),
  chosen: uuid(),
  updatedAt: at('updated_at').notNull(),
});

/**
 * A customer's answer to an issued quote: one per quote, never changed
 * once given. `digest` is the SHA-256 of the exact PDF the customer read,
 * so the acceptance names the document it covers; the network address and
 * browser are the evidence of who signed.
 */
export const responses = namespace.table(
  'responses',
  {
    quoteId: uuid('quote_id')
      .primaryKey()
      .references(() => invoices.id),
    outcome: text({ enum: ['accepted', 'declined'] }).notNull(),
    name: text().notNull(),
    email: text().notNull(),
    earlyStart: boolean('early_start').notNull(),
    language: text().notNull(),
    digest: text().notNull(),
    address: text().notNull(),
    agent: text().notNull(),
    decidedAt: at('decided_at').notNull(),
    confirmedAt: at('confirmed_at'),
    /** The accepted plan as it stood, so later edits never move it. */
    plan: jsonb(),
  },
  (table) => [
    check(
      'responses_outcome_known',
      sql`${table.outcome} in ('accepted', 'declined')`,
    ),
    check(
      'responses_early_start_accepted',
      sql`not ${table.earlyStart} or ${table.outcome} = 'accepted'`,
    ),
  ],
);

/**
 * The invoice each payment of an accepted quote was billed with. One per
 * payment, so drafting a payment's invoice twice finds the first.
 */
export const billed = namespace.table(
  'billed',
  {
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => invoices.id),
    payment: integer().notNull(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .unique()
      .references(() => invoices.id),
  },
  (table) => [primaryKey({ columns: [table.quoteId, table.payment] })],
);

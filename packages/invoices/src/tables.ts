import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
/** Single-table definitions for invoices, sequences, directory records, artifacts, audit, and sessions. */
export const invoices = pgTable('invoices', {
  id: uuid().primaryKey(),
  revision: integer().notNull(),
  status: text().notNull(),
  number: text().unique(),
  issueKey: text('issue_key').unique(),
  payload: jsonb().notNull(),
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});
export const sequences = pgTable('invoice_sequences', {
  key: text().primaryKey(),
  value: integer().notNull(),
  lastDate: text('last_date').notNull(),
});
export const records = pgTable('invoice_records', {
  key: text().primaryKey(),
  kind: text().notNull(),
  payload: jsonb().notNull(),
});
export const artifacts = pgTable('invoice_artifacts', {
  key: text().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  language: text().notNull(),
  digest: text().notNull(),
  bytes: text().notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});
export const audit = pgTable('invoice_audit', {
  id: uuid().primaryKey(),
  invoiceId: uuid('invoice_id'),
  operation: text().notNull(),
  actor: text().notNull(),
  payload: jsonb().notNull(),
  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});
export const secrets = pgTable('invoice_sessions', {
  key: text().primaryKey(),
  payload: jsonb().notNull(),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
});

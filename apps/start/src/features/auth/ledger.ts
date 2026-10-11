/**
 * The table that records which auth migrations ran, beside the invoices' in
 * Drizzle's `drizzle` schema. drizzle.config.ts and the running app both
 * read it.
 */
export const ledger = {
  migrationsSchema: 'drizzle',
  migrationsTable: 'auth',
} as const;

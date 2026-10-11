/**
 * The table that records which invoice migrations ran. It sits in Drizzle's
 * own `drizzle` schema, one table per module, so the migration that creates
 * the `invoices` schema never meets its own ledger. drizzle.config.ts and
 * the running app both read it.
 */
export const ledger = {
  migrationsSchema: 'drizzle',
  migrationsTable: 'invoices',
} as const;

import { defineConfig } from 'drizzle-kit';
import { ledger } from './src/ledger';

// `db:generate` writes a migration from src/tables.ts; `db:migrate` applies
// pending ones to DATABASE_URL, as a deploy step. Local PGlite databases
// apply them on their own when they open.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/tables.ts',
  out: './drizzle',
  schemaFilter: ['invoices'],
  migrations: {
    schema: ledger.migrationsSchema,
    table: ledger.migrationsTable,
  },
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});

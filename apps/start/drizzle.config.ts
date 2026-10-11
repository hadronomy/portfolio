import { defineConfig } from 'drizzle-kit';
import { ledger } from './src/features/auth/ledger';
import { authNamespace } from './src/features/auth/shared';

// The auth tables. `auth:generate` rewrites src/features/auth/tables.ts from
// the better-auth options; `db:generate` turns the change into a migration;
// `db:migrate` applies pending ones to DATABASE_URL as a deploy step. Local
// PGlite databases apply them on their own when they open.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/features/auth/tables.ts',
  out: './drizzle',
  schemaFilter: [authNamespace],
  migrations: {
    schema: ledger.migrationsSchema,
    table: ledger.migrationsTable,
  },
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});

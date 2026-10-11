import type { Postgres } from '@portfolio/database';
import { ledger } from './ledger';

/**
 * The auth migrations drizzle-kit generated, inlined at build time so a
 * local database can apply them from any bundle.
 */
export const migrations: Postgres.Migrations = {
  ...ledger,
  files: import.meta.glob('../../../drizzle/*/migration.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

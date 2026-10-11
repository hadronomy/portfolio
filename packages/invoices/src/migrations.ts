import type { Postgres } from '@portfolio/database';
import { ledger } from './ledger';

/**
 * The invoice migrations drizzle-kit generated, inlined at build time so a
 * local database can apply them from any bundle. Kept apart from the
 * database service: the inlining is Vite's, and code bundled by anything
 * else, such as the payments Worker, must not import it.
 */
export const migrations: Postgres.Migrations = {
  ...ledger,
  files: import.meta.glob('../drizzle/*/migration.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

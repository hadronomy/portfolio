import { PGlite } from '@electric-sql/pglite';
import { drizzle as postgres } from 'drizzle-orm/node-postgres';
import { drizzle as pglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import migration from './migrations/0001.sql?raw';
import * as tables from './tables';
export interface DatabaseOptions {
  readonly url?: string;
  readonly directory?: string;
}
/** Local and hosted databases execute the same PostgreSQL schema. Pass a directory only for persistent local development. */
export async function openDatabase(options: DatabaseOptions = {}) {
  const client = options.url
    ? new Pool({ connectionString: options.url, max: 3 })
    : new PGlite(options.directory);
  const db =
    client instanceof Pool
      ? postgres(client, { schema: tables })
      : pglite(client, { schema: tables });
  if (client instanceof Pool) await client.query(migration);
  else await client.exec(migration);
  return {
    db,
    close: () => (client instanceof Pool ? client.end() : client.close()),
  };
}
export type Database = Awaited<ReturnType<typeof openDatabase>>;

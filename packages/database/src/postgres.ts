import type * as EffectPg from 'drizzle-orm/effect-postgres';
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core/async/db';
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations';
import { Context, type Effect } from 'effect';

// The app's one PostgreSQL database, wherever it lives. Development and
// tests embed PGlite (`@portfolio/database/local`); production servers
// connect to a hosted one (`@portfolio/database/hosted`). Modules never learn
// which: each asks for a Drizzle database typed by its own relations, and gets
// one over the shared connection. This file is only the contract, so code that
// runs where neither adapter can, such as a Worker, imports it for free.

/**
 * A Drizzle database whose queries are Effects, typed by `R`. Queries fail
 * with `EffectDrizzleQueryError`; `transaction` adds `SqlError`.
 */
export type Database<R extends AnyRelations = EmptyRelations> =
  EffectPg.EffectPgDatabase<R>;

/**
 * The same database for libraries that await promises, such as better-auth.
 * It shares the embedded database; against a hosted server it holds a small
 * pool of its own, since the Effect client speaks its own protocol.
 */
// biome-ignore lint/suspicious/noExplicitAny: the query-result kind differs per driver and callers never read it.
export type PromiseDatabase<R extends AnyRelations> = PgAsyncDatabase<any, R>;

/**
 * A module's migrations as drizzle-kit wrote them, carried in the bundle so a
 * built server needs no migrations folder on disk. The ledger names the same
 * table as the module's drizzle.config.ts, so `drizzle-kit migrate` and a
 * local database record each migration once, under the same hash.
 */
export interface Migrations {
  readonly migrationsSchema: string;
  readonly migrationsTable: string;
  /** Each `<timestamp>_<name>/migration.sql`, keyed by its path. */
  readonly files: Readonly<Record<string, string>>;
}

export interface PostgresApi {
  /** A Drizzle database over this connection, typed by `relations`. */
  readonly drizzle: <R extends AnyRelations>(
    relations: R,
  ) => Effect.Effect<Database<R>>;
  /** The promise flavour of `drizzle`, for code outside Effect. */
  readonly promise: <R extends AnyRelations>(
    relations: R,
  ) => PromiseDatabase<R>;
}

/** The connection every module's database is built on. */
export class Postgres extends Context.Service<Postgres, PostgresApi>()(
  'Postgres',
) {}

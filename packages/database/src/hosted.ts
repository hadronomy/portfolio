import { PgClient } from '@effect/sql-pg';
import * as EffectPg from 'drizzle-orm/effect-postgres';
import { drizzle as nodePostgres } from 'drizzle-orm/node-postgres';
import { Effect, Layer, Redacted } from 'effect';
import * as Reactivity from 'effect/reactivity/Reactivity';
import { Pool } from 'pg';
import { Postgres } from '#postgres';

/**
 * A hosted PostgreSQL server. Its schema is applied at deploy time with
 * `drizzle-kit migrate`, never by a running server.
 */
export const layer = (options: { readonly url: Redacted.Redacted<string> }) =>
  Layer.effect(
    Postgres,
    Effect.gen(function* () {
      // Four sockets per instance: two for invoices, two for auth. Neon uses
      // transaction pooling. Unnamed protocol statements need no session state.
      // https://neon.com/docs/connect/connection-pooling
      const client = yield* PgClient.make({
        url: options.url,
        maxConnections: 2,
        minConnections: 0,
        idleTimeout: '10 seconds',
        connectTimeout: '10 seconds',
        ssl: { rejectUnauthorized: true },
        prepare: false,
      });
      const url = new URL(Redacted.value(options.url));
      // pg's URL parser replaces the TLS object when sslmode is present.
      // Keep certificate verification mandatory for both database drivers.
      // https://node-postgres.com/features/ssl#usage-with-connectionstring
      for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'])
        url.searchParams.delete(key);
      const pool = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Pool({
              connectionString: url.toString(),
              max: 2,
              idleTimeoutMillis: 10_000,
              connectionTimeoutMillis: 10_000,
              ssl: { rejectUnauthorized: true },
            }),
        ),
        (pool) => Effect.promise(() => pool.end()),
      );
      return Postgres.of({
        drizzle: (relations) =>
          EffectPg.makeWithDefaults({ relations }).pipe(
            Effect.provideService(PgClient.PgClient, client),
          ),
        promise: (relations) => nodePostgres({ client: pool, relations }),
      });
    }),
  ).pipe(Layer.provide(Reactivity.layer));

export * as PostgresHosted from '#hosted';

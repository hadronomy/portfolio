import { PgClient } from '@effect/sql-pg';
import * as EffectPg from 'drizzle-orm/effect-postgres';
import { drizzle as nodePostgres } from 'drizzle-orm/node-postgres';
import { Effect, Layer, Redacted } from 'effect';
import * as Reactivity from 'effect/reactivity/Reactivity';
import { Pool } from 'pg';
import { Postgres } from './postgres';

/**
 * A hosted PostgreSQL server. Its schema is applied at deploy time with
 * `drizzle-kit migrate`, never by a running server.
 */
export const layer = (options: { readonly url: Redacted.Redacted<string> }) =>
  Layer.effect(
    Postgres,
    Effect.gen(function* () {
      const client = yield* PgClient.make({ url: options.url });
      const pool = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Pool({
              connectionString: options.url.pipe(Redacted.value),
              max: 3,
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

export * as PostgresHosted from './hosted';

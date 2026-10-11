import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Effect, type Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { Postgres } from './index';
import { PostgresLocal } from './local';

const run = <A>(
  layer: Layer.Layer<Postgres.Postgres, unknown>,
  body: (postgres: Postgres.PostgresApi) => Effect.Effect<A, unknown>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* Postgres.Postgres);
  }).pipe(Effect.provide(layer), Effect.scoped, Effect.runPromise);

const first =
  'CREATE SCHEMA "probe";\n--> statement-breakpoint\nCREATE TABLE "probe"."items" ("id" int);';
const second = 'INSERT INTO "probe"."items" VALUES (1);';

describe('PostgresLocal.layer', () => {
  it('serves Effect and promise databases over one embedded connection', async () => {
    const rows = await run(
      PostgresLocal.layer({ migrations: [] }),
      (postgres) =>
        Effect.gen(function* () {
          const db = yield* postgres.drizzle({});
          yield* db.execute(sql`create table probe (id int)`);
          yield* db.execute(sql`insert into probe values (1)`);
          const viaPromise = yield* Effect.promise(() =>
            postgres.promise({}).execute(sql`select id from probe`),
          );
          return viaPromise.rows;
        }),
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it('applies bundled migrations in order and records them as drizzle-kit does', async () => {
    const ledger = await run(
      PostgresLocal.layer({
        migrations: [
          {
            migrationsSchema: 'drizzle',
            migrationsTable: 'probe',
            // Out of order on purpose: names sort by their timestamps.
            files: {
              '../drizzle/20261002000000_seed/migration.sql': second,
              '../drizzle/20261001000000_init/migration.sql': first,
            },
          },
        ],
      }),
      (postgres) =>
        Effect.promise(async () => {
          const db = postgres.promise({});
          const items = await db.execute(sql`select id from probe.items`);
          const applied = await db.execute(
            sql`select hash, name from drizzle.probe order by created_at`,
          );
          return { items: items.rows, applied: applied.rows };
        }),
    );
    expect(ledger.items).toEqual([{ id: 1 }]);
    expect(ledger.applied).toEqual([
      {
        hash: createHash('sha256').update(first).digest('hex'),
        name: '20261001000000_init',
      },
      {
        hash: createHash('sha256').update(second).digest('hex'),
        name: '20261002000000_seed',
      },
    ]);
  });
});

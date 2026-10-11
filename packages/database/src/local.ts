import { createHash } from 'node:crypto';
import { PgliteClient } from '@effect/sql-pglite';
import { PGlite } from '@electric-sql/pglite';
import * as EffectPglite from 'drizzle-orm/effect-pglite';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import { formatToMillis } from 'drizzle-orm/migrator.utils';
import { migrate } from 'drizzle-orm/pg-core/effect';
import { drizzle as pglite } from 'drizzle-orm/pglite';
import type { AnyRelations } from 'drizzle-orm/relations';
import { Effect, Layer } from 'effect';
import * as Reactivity from 'effect/reactivity/Reactivity';
import { type Database, type Migrations, Postgres } from './postgres';

/** Reads migration files the way drizzle-kit's own migrator reads its folder. */
function plan(files: Migrations['files']): MigrationMeta[] {
  return Object.entries(files)
    .map(([path, sql]) => {
      const name = path.split('/').at(-2) ?? path;
      return {
        name,
        sql: sql.split('--> statement-breakpoint'),
        bps: true,
        folderMillis: formatToMillis(name.slice(0, 14)),
        hash: createHash('sha256').update(sql).digest('hex'),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * An embedded PGlite database, in memory or kept in `directory`. Opening it
 * applies every module's pending migrations, so a fresh directory, a test,
 * and a pulled branch all start current.
 */
export const layer = (options: {
  readonly directory?: string | undefined;
  readonly migrations: readonly Migrations[];
}) =>
  Layer.effect(
    Postgres,
    Effect.gen(function* () {
      const embedded = yield* Effect.acquireRelease(
        Effect.promise(() => PGlite.create(options.directory)),
        (database) => Effect.promise(() => database.close()),
      );
      const client = yield* PgliteClient.fromClient({ liveClient: embedded });
      const drizzle = <R extends AnyRelations>(relations: R) =>
        EffectPglite.makeWithDefaults({ relations }).pipe(
          Effect.provideService(PgliteClient.PgliteClient, client),
          // Both drivers build the same database over different clients.
          Effect.map((database) => database as unknown as Database<R>),
        );
      const migrator = yield* EffectPglite.makeWithDefaults().pipe(
        Effect.provideService(PgliteClient.PgliteClient, client),
      );
      for (const { files, ...ledger } of options.migrations)
        yield* migrate(plan(files), migrator._.session, {
          ...ledger,
          // Read only to find files on disk; these come from the bundle.
          migrationsFolder: '',
        });
      return Postgres.of({
        drizzle,
        promise: (relations) => pglite({ client: embedded, relations }),
      });
    }),
  ).pipe(Layer.provide(Reactivity.layer));

export * as PostgresLocal from './local';

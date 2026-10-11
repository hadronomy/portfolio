import { InvoiceDatabase } from '@portfolio/invoices/database';
import { relations } from '@portfolio/invoices/relations';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Drizzle from 'alchemy/Drizzle/Postgres';
import { Config, Effect, Layer, Redacted, Schema } from 'effect';

// The invoice database, reached through Hyperdrive: the same PostgreSQL the
// web app uses, with Hyperdrive pooling connections near the Worker. A
// Worker event cannot keep a connection past itself, so the pool opens on
// the first query of each event and closes when the event ends.

const PostgresUrl = Schema.String.check(
  Schema.isPattern(/^postgres(ql)?:\/\//),
);

/** The database URL, `postgres://user:password@host:port/database`. */
const DatabaseUrl = Config.schema(PostgresUrl, 'DATABASE_URL').pipe(
  Config.map(Redacted.make),
);

/**
 * The Hyperdrive configuration in front of the invoice database. `alchemy
 * dev` has no Hyperdrive, so there it connects straight to the same URL,
 * which must be a database the machine can reach.
 */
export const Database = Effect.gen(function* () {
  const url = new URL(Redacted.value(yield* DatabaseUrl));
  const origin = {
    scheme: 'postgres' as const,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: Redacted.make(decodeURIComponent(url.password)),
  };
  return yield* Cloudflare.Hyperdrive.Connection('Database', {
    origin,
    // Payment state read from a cache could settle an invoice twice.
    caching: { disabled: true },
    dev: {
      ...origin,
      sslmode: url.hostname === 'localhost' ? 'disable' : 'require',
    },
  });
});

/** The invoice database over Hyperdrive, opened lazily per event. */
export const invoiceDatabase = Effect.gen(function* () {
  const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(yield* Database);
  const database = yield* Drizzle.Postgres(hyperdrive.connectionString, {
    relations,
  });
  return Layer.succeed(InvoiceDatabase, database);
});

import { PgClient } from '@effect/sql-pg';
import { PostgresHosted } from '@portfolio/database/hosted';
import { Effect, Redacted } from 'effect';
import { Client, Pool } from 'pg';
import { expect, it, vi } from 'vitest';
import { Postgres } from '#postgres';

vi.mock('@effect/sql-pg', async (original) => {
  const actual = await original<typeof import('@effect/sql-pg')>();
  return {
    ...actual,
    PgClient: { ...actual.PgClient, make: vi.fn(actual.PgClient.make) },
  };
});
vi.mock('pg', async (original) => {
  const actual = await original<typeof import('pg')>();
  return { ...actual, Pool: vi.fn(class extends actual.Pool {}) };
});

it('bounds both pools and prevents URL parameters from disabling verified TLS', async () => {
  const url = Redacted.make(
    'postgres://user:password@example.com/db?sslmode=disable&ssl=false',
  );
  await Effect.gen(function* () {
    yield* Postgres;
  }).pipe(
    Effect.provide(PostgresHosted.layer({ url })),
    Effect.scoped,
    Effect.runPromise,
  );
  expect(vi.mocked(PgClient.make)).toHaveBeenCalledWith(
    expect.objectContaining({
      maxConnections: 2,
      minConnections: 0,
      idleTimeout: '10 seconds',
      connectTimeout: '10 seconds',
      prepare: false,
      ssl: { rejectUnauthorized: true },
    }),
  );
  const options = vi.mocked(Pool).mock.calls[0]?.[0];
  expect(options).toMatchObject({
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true },
  });
  // Client parses the URL after the pool receives its options.
  const client = new Client(options);
  expect(client.ssl).toEqual({ rejectUnauthorized: true });
});

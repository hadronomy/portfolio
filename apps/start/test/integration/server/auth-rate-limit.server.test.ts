import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { Postgres } from '@portfolio/database';
import { PostgresLocal } from '@portfolio/database/local';
import { betterAuth } from 'better-auth';
import { ManagedRuntime } from 'effect';
import { expect, it } from 'vitest';
import { migrations } from '~/features/auth/migrations';
import { authOptions } from '~/features/auth/options';
import { authNamespace } from '~/features/auth/shared';
import * as tables from '~/features/auth/tables';
import { clientAddressHeader } from '~/server/client-address.server';

it('shares OTP rate limits across independent auth handlers', async () => {
  const runtime = ManagedRuntime.make(
    PostgresLocal.layer({ migrations: [migrations] }),
  );
  try {
    const postgres = await runtime.runPromise(Postgres.Postgres);
    const database = postgres.promise(tables.authRelations);
    const origin = 'http://127.0.0.1:4321';
    const make = () =>
      betterAuth({
        ...authOptions({
          origin,
          admits: async () => false,
          sendCode: async () => {},
          atprotoKeys: [],
        }),
        baseURL: origin,
        secret: 'test-only-secret-at-least-thirty-two-characters',
        database: drizzleAdapter(database, {
          provider: 'pg',
          schema: tables,
          schemaName: authNamespace,
          transaction: true,
        }),
        advanced: { ipAddress: { ipAddressHeaders: [clientAddressHeader] } },
        rateLimit: { enabled: true, storage: 'database' },
      });
    const first = make();
    await first.$context;
    const second = make();
    await second.$context;
    const handlers = [first, second];
    const send = (index: number) =>
      handlers[index % 2]?.handler(
        new Request(`${origin}/invoices/auth/email-otp/send-verification-otp`, {
          method: 'POST',
          headers: {
            origin,
            'content-type': 'application/json',
            [clientAddressHeader]: '203.0.113.4',
            'cf-connecting-ip': `192.0.2.${index}`,
            'x-forwarded-for': `192.0.2.${index}`,
          },
          body: JSON.stringify({
            email: 'stranger@example.com',
            type: 'sign-in',
          }),
        }),
      );
    for (let index = 0; index < 3; index++)
      expect((await send(index))?.status).toBe(200);
    const denied = await send(3);
    expect(denied?.status).toBe(429);
    expect(denied?.headers.has('x-retry-after')).toBe(true);
    const rows = await database.select().from(tables.rateLimit);
    expect(rows.some((row) => row.key.includes('203.0.113.4'))).toBe(true);
    expect(rows.some((row) => row.key.includes('192.0.2.'))).toBe(false);
  } finally {
    await runtime.dispose();
  }
}, 30_000);

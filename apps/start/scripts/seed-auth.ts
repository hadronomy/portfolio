import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Effect, Redacted } from 'effect';
import { authOptions } from '~/features/auth/options';
import { authNamespace } from '~/features/auth/shared';
import * as tables from '~/features/auth/tables';
import { AppConfig, appConfigLayer } from '~/server/config.server';
import { agentOrigin } from '~/server/origin.server';

const settings = await Effect.runPromise(
  AppConfig.useSync((settings) => settings).pipe(
    Effect.provide(appConfigLayer),
  ),
);
if (!settings.databaseUrl || !settings.secret)
  throw new Error('Set DATABASE_URL and INVOICE_SECRET before the auth seed.');
const origin = agentOrigin({
  configured: settings.origin,
  production: true,
});
const database = drizzle({
  connection: {
    connectionString: Redacted.value(settings.databaseUrl),
    max: 1,
    connectionTimeoutMillis: 30_000,
  },
  relations: tables.authRelations,
});
try {
  // Auth initialization seeds the MCP resource without serving a request or sending mail.
  const auth = betterAuth({
    ...authOptions({
      origin,
      atprotoKeys: settings.atprotoKeys,
      admits: async () => false,
      sendCode: async () => {
        throw new Error('The deploy seed cannot send sign-in codes.');
      },
    }),
    baseURL: origin,
    secret: Redacted.value(settings.secret),
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: tables,
      schemaName: authNamespace,
      transaction: true,
    }),
    advanced: { trustedProxyHeaders: false },
  });
  await auth.$context;
  console.log('The MCP OAuth resource seed is complete.');
} finally {
  await database.$client.end();
}

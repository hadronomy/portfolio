import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { betterAuth } from 'better-auth';
import { authOptions } from './src/features/auth/options';
import { authNamespace } from './src/features/auth/shared';

// For the better-auth CLI only: `bun run auth:generate` reads the same
// options the server runs with and writes src/features/auth/tables.ts.
export const auth = betterAuth({
  ...authOptions({
    admits: async () => false,
    sendCode: async () => {},
    atprotoKeys: [],
    origin: 'http://127.0.0.1:4321',
  }),
  database: drizzleAdapter(
    {},
    { provider: 'pg', schemaName: authNamespace, transaction: true },
  ),
});

// The CLI reads only the options. The context betterAuth() starts at once
// seeds the MCP resource into a database the CLI does not have, so that
// start fails here by design and must not take the CLI down with it.
auth.$context.catch(() => {});

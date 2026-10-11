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
  }),
  database: drizzleAdapter(
    {},
    { provider: 'pg', schemaName: authNamespace, transaction: true },
  ),
});

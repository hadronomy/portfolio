import { packageTests } from '@portfolio/vitest-config';

// Tests run against source modules directly. The app's vite.config.ts carries
// the TanStack Start build plugin, which tests do not need, so they get a
// config of their own; `~/` comes from tsconfig.json, as it does for the app.
export default packageTests(import.meta.dirname, {
  resolve: { tsconfigPaths: true },
});

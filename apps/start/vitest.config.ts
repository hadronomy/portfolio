import { defineConfig } from 'vitest/config';

// Unit tests run against source modules directly. The app's vite.config.ts
// carries the TanStack Start build plugin, which tests do not need, so they
// get a config of their own. The agent and mail tests boot an embedded
// PGlite, which is slow on a busy CI runner, hence the longer time limit.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});

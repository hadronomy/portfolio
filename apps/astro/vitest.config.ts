import { defineConfig } from 'vitest/config';

// Integration suites: each one starts a real server (dev or built) on a free
// port, so files run one at a time and hooks get room to boot.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.mjs'],
    // Each test's spies come off when it ends, as node:test's t.mock did.
    restoreMocks: true,
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});

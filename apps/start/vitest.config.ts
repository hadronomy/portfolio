import { defineConfig } from 'vitest/config';

// Unit tests run against source modules directly. The app's vite.config.ts
// carries the TanStack Start build plugin, which tests do not need, so they
// get a config of their own.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

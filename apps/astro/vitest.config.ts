import { packageTests } from '@portfolio/vitest-config';

// End-to-end suites against the real dev and built servers.
export default packageTests(import.meta.dirname, {
  test: {
    setupFiles: ['test/support/setup.mjs'],
    // Each test's spies come off when it ends, as node:test's t.mock did.
    restoreMocks: true,
  },
});

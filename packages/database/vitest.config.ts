import { defineConfig } from 'vitest/config';

// Each test boots an embedded PGlite; with every workspace suite running at
// once, that alone can take ten seconds.
export default defineConfig({
  test: { testTimeout: 30_000 },
});

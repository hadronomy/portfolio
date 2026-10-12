import { defineConfig } from 'vitest/config';

// Tests run against an embedded PGlite and render real PDFs. With every
// workspace suite sharing the CI runner, one quote test can take several
// seconds, well past Vitest's five-second default.
export default defineConfig({
  test: { testTimeout: 30_000 },
});

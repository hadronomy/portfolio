// These suites boot real Astro and Start servers inside the Vitest worker,
// and the worker's environment describes the test runner, not those servers.
// Astro's dev server skips its request handler entirely when VITEST is set
// (that mode exists for unit-testing components through getViteConfig), and
// Vitest's MODE=test and BASE_URL=/ would stand in for the servers' own.
// Clearing them lets each server run as it does outside the tests.
for (const key of ['VITEST', 'MODE', 'BASE_URL', 'DEV', 'PROD', 'SSR'])
  delete process.env[key];
process.env.NODE_ENV = 'development';

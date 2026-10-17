import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

// Every package lays its tests out by what a suite needs to run:
//
//   test/unit/         pure modules: no database, no server
//   test/integration/  an embedded PGlite or the app's own layers
//   test/e2e/          a running server, started by the suite
//   test/support/      helpers the suites share, never collected
//
// Paths under each folder mirror src/, so a module's tests sit where its path
// says. The kinds differ only in how long a test may take and whether files
// run side by side, and those limits live here alone.

const kinds = {
  unit: {},
  // Booting PGlite and applying every migration takes seconds on a busy CI
  // runner, before the test itself does anything.
  integration: { testTimeout: 30_000, hookTimeout: 30_000 },
  // Each file starts its own server on a free port: one file at a time, and
  // room for a cold build in the hooks.
  e2e: { testTimeout: 60_000, hookTimeout: 180_000, fileParallelism: false },
} as const;

/**
 * The Vitest config of the package in `root` (pass `import.meta.dirname`):
 * one project for each kind of test folder the package has, named after the
 * kind, so `vitest --project '*(unit)'` runs every unit suite in the
 * workspace. `shared` (aliases, setup files) applies to all of them.
 */
export function packageTests(root: string, shared: ViteUserConfig = {}) {
  const projects = Object.entries(kinds)
    .filter(([kind]) => existsSync(join(root, 'test', kind)))
    .map(([kind, limits]) => ({
      extends: true,
      test: {
        name: kind,
        include: [`test/${kind}/**/*.test.{ts,tsx,mjs}`],
        ...limits,
      },
    }));
  return mergeConfig(
    defineConfig({ test: { environment: 'node', projects } }),
    shared,
  );
}

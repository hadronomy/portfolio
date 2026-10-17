import { defineConfig } from 'vitest/config';

// Every package's suites from the repository root, as the editor and
// `vitest` without turbo see them. Each package's own config decides its
// projects (see tooling/vitest-config); turbo still runs them package by
// package in CI. Filter by kind or by package:
//
//   vitest --project '*(unit)'
//   vitest --project '@portfolio/invoices*'
export default defineConfig({
  test: {
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'scripts/deploy/vitest.config.mts',
    ],
  },
});

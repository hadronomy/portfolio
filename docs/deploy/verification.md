# Local verification

These checks ran on 2026-10-12 in `portfolio.deploy-ops`, on branch `deploy/ops`.
The runtime was Node 24.21.0. The package manager was Bun 1.4.2.
CI pins Bun 1.3.2, which matches the repository's package-manager declaration.

| Command                                                                            | Result                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `bun install`                                                                      | Passed. Installed 1,681 packages.                                                                                              |
| `bun install --frozen-lockfile --prefer-offline --network-concurrency 4 --verbose` | Passed without lockfile changes.                                                                                               |
| `git remote -v`                                                                    | Remote: `git@github.com:hadronomy/portfolio.git`.                                                                              |
| `gh repo view --json visibility,nameWithOwner`                                     | Public repository.                                                                                                             |
| `bun run build`                                                                    | Node production build passed. Astro reported no errors or warnings.                                                            |
| `VERCEL=1 VERCEL_ENV=preview ASTRO_TELEMETRY_DISABLED=1 bun run build`             | Vercel production output passed.                                                                                               |
| `bun turbo run check test db:check`                                                | All six package checks and both schema checks passed. Seven test suites passed. Astro failed during a concurrent Vercel build. |
| `ASTRO_TELEMETRY_DISABLED=1 bun run --cwd apps/astro test`                         | Sequential rerun passed: 30 tests in four files.                                                                               |
| `bun run --cwd apps/payments check`                                                | Passed.                                                                                                                        |
| `bun run --cwd apps/payments test`                                                 | Passed: six tests.                                                                                                             |
| `bun run --cwd apps/payments deploy --help`                                        | Confirmed the installed CLI and `--stage` support. No deployment ran.                                                          |
| `bun run --cwd packages/invoices db:check`                                         | Passed.                                                                                                                        |
| `bun run --cwd apps/start db:check`                                                | Passed.                                                                                                                        |
| `node --test scripts/deploy/ops.test.mjs`                                          | Passed: nine guard tests.                                                                                                      |
| `bun biome ci scripts/deploy package.json turbo.json apps/payments/package.json`   | Passed without edits.                                                                                                          |
| `bun prettier --check .github/workflows docs/deploy/README.md`                     | Passed.                                                                                                                        |
| `bash -n scripts/deploy/install-tools.sh`                                          | Passed.                                                                                                                        |
| `git diff --check`                                                                 | Passed.                                                                                                                        |
| `bun turbo run build --filter=@portfolio/astro --dry=json`                         | Includes auth-atproto, database, i18n, invoices, and site-routing sources. Includes certificate variables.                     |
| `bun run ci`                                                                       | Fails on an existing formatting error in `tooling/tsconfig/package.json`. This file was outside the assigned ops changes.      |

The application suites passed 215 tests in total after the sequential Astro rerun.
The local ops guards passed nine more tests.

## PostgreSQL recovery

Docker was installed, but its daemon did not start.
A temporary PostgreSQL 18.4 distribution and matching-major PostgreSQL 18.6 client tools ran inside the worktree.
Their downloaded packages passed their published integrity checks.
The PostgreSQL repository key matched fingerprint `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`.

The integration command was:

```sh
POSTGRES_TEST_URL='postgres://hadronomy@127.0.0.1:55481/portfolio_restore_admin?sslmode=disable' \
PATH="$PWD/.ops-tools/postgres-client/postgresql@18/18.6_1/bin:$PWD/.ops-tools/age:$PATH" \
node scripts/deploy/restore.integration.mjs
```

It passed with real PostgreSQL, `pg_dump`, age, and `pg_restore`.
Both migration sets ran twice to check repeat application.
The fixture contained an auth record, an invoice record, and stored PDF bytes.
The script compared schema columns, all row counts, migration hashes, and restored artifact bytes.
A repeat backup preserved the first monthly snapshot.
A second restore into the populated target failed as required.
A local S3 fixture replaced R2. No provider credential or record data appeared in the output.
CI repeats this integration test against a PostgreSQL service container.

## Remaining checks

Live Neon migrations, R2 uploads, Cloudflare deployment, and Vercel promotion remain unverified.
Linux Actions execution and provider flows remain unverified.
The Worker still needs real CPU, memory, queue, and Hyperdrive measurements on the Free plan.
Vercel Hobby's commercial-use restriction remains a hosting gap.

The production age identity was created and checked in 1Password's Code vault.
Its item is **Portfolio database backup age**, ID `ab5mkbql26ib2fymedu3qa5lve`.
Only its public recipient is in the repository.
The owner still needs an offline recovery copy.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export function migrationUrl(env) {
  if (
    env.VERCEL !== '1' ||
    !['production', 'preview', 'development'].includes(env.VERCEL_ENV)
  )
    throw new Error(
      'Expose Vercel system variables before the production build.',
    );
  if (env.VERCEL_ENV !== 'production') return undefined;
  if (!env.DATABASE_URL_UNPOOLED)
    throw new Error('Set DATABASE_URL_UNPOOLED for production migrations.');
  const url = new URL(env.DATABASE_URL_UNPOOLED);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname.includes('-pooler')
  ) {
    throw new Error('Production migrations require a direct PostgreSQL URL.');
  }
  if (
    url.searchParams.get('sslmode') !== 'require' &&
    url.searchParams.get('sslmode') !== 'verify-full'
  ) {
    throw new Error('Production migrations require TLS.');
  }
  if (!env.DATABASE_URL)
    throw new Error('Set the pooled application DATABASE_URL.');
  const app = new URL(env.DATABASE_URL);
  if (
    app.hostname.replace('-pooler.', '.') !== url.hostname ||
    app.pathname !== url.pathname ||
    (app.port || '5432') !== (url.port || '5432')
  ) {
    throw new Error('The pooled and direct URLs must use the same database.');
  }
  return url.href;
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // Migrations run outside Turbo so a build cache hit cannot skip them.
  const url = migrationUrl(process.env);
  const build = spawnSync('bun', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.error || build.status !== 0) process.exit(build.status || 1);
  if (!url) return;
  const require = createRequire(
    new URL('../../apps/start/package.json', import.meta.url),
  );
  const { Client } = require('pg');
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 30_000,
  });
  try {
    await client.connect();
    await client.query("SET statement_timeout = '5min'");
    // Concurrent git builds share this lock until both migration ledgers finish.
    await client.query(
      "SELECT pg_advisory_lock(hashtext('portfolio-production-migrations'))",
    );
    const migration = spawnSync('bun', ['run', 'db:migrate'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      timeout: 300_000,
    });
    if (migration.error || migration.status !== 0)
      throw new Error(
        'Migration failed. The deployment must not serve traffic.',
      );
    console.log('Invoice and auth migrations are complete.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error(
      'Production build failed. Check the direct database URL and pending migrations locally.',
    );
    process.exitCode = 1;
  });
}

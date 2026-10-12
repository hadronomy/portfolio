import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { redactDatabase } from './redact.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

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

export function runDeployCommand(command, args, env, output = process) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 300_000);
    timeout.unref();
    // Redact complete lines so a credential split across chunks cannot leak.
    for (const name of ['stdout', 'stderr']) {
      const lines = createInterface({
        input: child[name],
        crlfDelay: Infinity,
      });
      lines.on('line', (line) =>
        output[name].write(`${redactDatabase(line, env)}\n`),
      );
    }
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else
        reject(
          new Error(`${command} ${args.join(' ')} failed (${signal ?? code}).`),
        );
    });
  });
}

export async function migrateAndSeed(url, env) {
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
    // Auth must finish its insert-only resource seed before cold instances can start.
    await client.query(
      "SELECT pg_advisory_lock(hashtext('portfolio-production-migrations'))",
    );
    const directEnv = { ...env, DATABASE_URL: url };
    await runDeployCommand('bun', ['run', 'db:migrate'], directEnv);
    await runDeployCommand(
      'bun',
      ['run', '--cwd', 'apps/start', 'seed:auth'],
      directEnv,
    );
    console.log(
      'Invoice and auth migrations and the MCP resource seed are complete.',
    );
  } finally {
    await client.end();
  }
}

async function main() {
  // Migrations run outside Turbo so a build cache hit cannot skip them.
  const url = migrationUrl(process.env);
  await runDeployCommand('bun', ['run', 'build'], process.env);
  if (url) await migrateAndSeed(url, process.env);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(redactDatabase(inspect(error, { depth: 5 }), process.env));
    process.exitCode = 1;
  });
}

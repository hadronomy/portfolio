import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export class OperatorError extends Error {}

export const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(
  new URL('../../apps/start/package.json', import.meta.url),
);
export const { Client } = require('pg');

export function required(name) {
  const value = process.env[name];
  if (!value) throw new OperatorError(`Set ${name}.`);
  return value;
}

export function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
  } catch {
    // PostgreSQL errors can contain row data. Keep subprocess output private.
    throw new OperatorError(
      `${command} failed. Check credentials, client versions, and the scratch database.`,
    );
  }
}

export function pgEnv(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new OperatorError('Use a PostgreSQL URL.');
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get('sslmode') || 'require',
    PGCHANNELBINDING: url.searchParams.get('channel_binding') || 'prefer',
    PGCONNECT_TIMEOUT: '30',
  };
}

export function directUrl(value) {
  const url = new URL(value);
  if (url.hostname.includes('-pooler'))
    throw new OperatorError('Use the direct database URL.');
  pgEnv(value);
  return value;
}

export async function clientMajor(client) {
  const { rows } = await client.query('SHOW server_version_num');
  return Math.floor(Number(rows[0].server_version_num) / 10_000);
}

export function checkClient(major) {
  const version = run('pg_dump', ['--version']);
  if (Number(version.match(/(\d+)\./)?.[1]) !== major) {
    throw new OperatorError(`Install PostgreSQL client ${major}.`);
  }
}

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

export async function inventory(client) {
  const { rows: tables } = await client.query(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema IN ('invoices', 'auth', 'drizzle') AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `);
  const counts = {};
  for (const { table_schema: schema, table_name: table } of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::text AS count FROM ${quote(schema)}.${quote(table)}`,
    );
    counts[`${schema}.${table}`] = rows[0].count;
  }
  for (const name of ['drizzle.invoices', 'drizzle.auth']) {
    if (!counts[name] || counts[name] === '0')
      throw new OperatorError('Apply both migration sets before the backup.');
  }
  if (
    !tables.some((table) => table.table_schema === 'invoices') ||
    !tables.some((table) => table.table_schema === 'auth')
  ) {
    throw new OperatorError('Both application schemas must exist.');
  }
  const { rows: columns } = await client.query(`
    SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema IN ('invoices', 'auth', 'drizzle')
    ORDER BY table_schema, table_name, ordinal_position
  `);
  const ledgers = {};
  for (const table of ['invoices', 'auth']) {
    const { rows } = await client.query(
      `SELECT hash, created_at::text FROM drizzle.${table} ORDER BY id`,
    );
    ledgers[table] = rows;
  }
  return { counts, columns, ledgers };
}

export function s3(args) {
  const endpoint = new URL(required('R2_ENDPOINT'));
  if (
    endpoint.protocol !== 'https:' ||
    !endpoint.hostname.endsWith('.r2.cloudflarestorage.com')
  ) {
    throw new OperatorError('Use the Cloudflare R2 HTTPS S3 endpoint.');
  }
  required('AWS_ACCESS_KEY_ID');
  required('AWS_SECRET_ACCESS_KEY');
  return run('aws', ['--endpoint-url', endpoint.href, ...args], {
    env: { ...process.env, AWS_DEFAULT_REGION: 'auto', AWS_PAGER: '' },
  });
}

export function objects() {
  return (
    JSON.parse(
      s3([
        's3api',
        'list-objects-v2',
        '--bucket',
        required('R2_BUCKET'),
        '--output',
        'json',
      ]),
    ).Contents || []
  );
}

export function retentionPlan(items, size, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const daily = `daily/${day}.tar.gz.age`;
  const monthly = `monthly/${month}.tar.gz.age`;
  const expired = items.filter(
    (item) =>
      /^daily\/\d{4}-\d{2}-\d{2}\.tar\.gz\.age$/.test(item.Key) &&
      now.getTime() -
        new Date(`${item.Key.slice(6, 16)}T00:00:00Z`).getTime() >=
        30 * 86_400_000,
  );
  const retained = items.filter((item) => !expired.includes(item));
  const addMonthly = !retained.some((item) => item.Key === monthly);
  const existingDaily = retained.find((item) => item.Key === daily)?.Size || 0;
  const total =
    retained.reduce((sum, item) => sum + item.Size, 0) -
    existingDaily +
    size * (addMonthly ? 2 : 1);
  const largest = Math.max(
    size,
    ...retained
      .filter((item) => /^(daily|monthly)\//.test(item.Key))
      .map((item) => item.Size),
  );
  // 30 daily + 85 monthly snapshots cover seven years and the current month.
  // One GB remains for other R2 use. Monthly archives never expire automatically.
  const peak = total + expired.reduce((sum, item) => sum + item.Size, 0);
  if (peak > 9_000_000_000 || largest * 115 > 9_000_000_000) {
    throw new OperatorError(
      'The backup exceeds the free R2 budget. Archive monthly backups offline before retrying.',
    );
  }
  return { daily, monthly, expired, addMonthly, total };
}

export function scratchUrl(value) {
  const url = new URL(value);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.pathname.startsWith('/portfolio_restore')
  ) {
    throw new OperatorError(
      'Restore only into a loopback database named portfolio_restore*.',
    );
  }
  return value;
}

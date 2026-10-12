import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, required, root, scratchUrl } from './ops.mjs';

process.umask(0o077);
const adminUrl = scratchUrl(required('POSTGRES_TEST_URL'));
const admin = new Client({ connectionString: adminUrl });
const dir = mkdtempSync(join(root, '.ops-integration-'));
const sourceName = `portfolio_restore_source_${process.pid}`;
const targetName = `portfolio_restore_target_${process.pid}`;
const sourceUrl = new URL(adminUrl);
sourceUrl.pathname = `/${sourceName}`;
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${targetName}`;
const source = new Client({ connectionString: sourceUrl.href });
const target = new Client({ connectionString: targetUrl.href });
let createdSource = false;
let createdTarget = false;

function run(command, args, env = {}) {
  try {
    return execFileSync(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
  } catch {
    throw new Error(
      `${command} failed during the local restore integration test.`,
    );
  }
}

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${sourceName}`);
  createdSource = true;
  await admin.query(`CREATE DATABASE ${targetName}`);
  createdTarget = true;
  run('bun', ['run', 'db:migrate'], { DATABASE_URL: sourceUrl.href });
  run('bun', ['run', 'db:migrate'], { DATABASE_URL: sourceUrl.href });
  await source.connect();
  await source.query(
    "INSERT INTO auth.\"user\" (id, name, email) VALUES ('restore-fixture', 'Fixture', 'restore@example.invalid')",
  );
  await source.query(
    "INSERT INTO invoices.invoices (id, revision, status, payload, updated_at) VALUES ('00000000-0000-4000-8000-000000000001', 1, 'draft', '{\"fixture\":true}', now())",
  );
  await source.query(
    "INSERT INTO invoices.artifacts (key, invoice_id, language, digest, bytes, created_at) VALUES ('fixture', '00000000-0000-4000-8000-000000000001', 'en', 'fixture', 'JVBERi0xLjQ=', now())",
  );

  const identity = join(dir, 'identity');
  run('age-keygen', ['-o', identity]);
  const recipient = run('age-keygen', ['-y', identity]).trim();
  const recipients = join(dir, 'recipients');
  writeFileSync(recipients, `${recipient}\n`);
  const storage = join(dir, 's3.json');
  writeFileSync(storage, '{}');
  // This fixture exercises the real archive path without production S3 credentials.
  writeFileSync(
    join(dir, 'aws'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const store = JSON.parse(fs.readFileSync(process.env.TEST_S3_STORE, 'utf8'));
const action = args[3];
const value = (flag) => args[args.indexOf(flag) + 1];
if (action === 'list-objects-v2') {
  console.log(JSON.stringify({ Contents: Object.entries(store).map(([Key, item]) => ({ Key, Size: Buffer.from(item.body, 'base64').length, LastModified: item.date })) }));
} else if (action === 'put-object') {
  store[value('--key')] = { body: fs.readFileSync(value('--body')).toString('base64'), date: new Date().toISOString() };
} else if (action === 'get-object') {
  fs.writeFileSync(args.at(-1), Buffer.from(store[value('--key')].body, 'base64'));
} else if (action === 'delete-object') {
  delete store[value('--key')];
} else { process.exit(1); }
fs.writeFileSync(process.env.TEST_S3_STORE, JSON.stringify(store));
`,
    { mode: 0o700 },
  );
  const env = {
    PATH: `${dir}:${process.env.PATH}`,
    TEST_S3_STORE: storage,
    DATABASE_URL_UNPOOLED: sourceUrl.href,
    BACKUP_RECIPIENTS_FILE: recipients,
    R2_ENDPOINT: 'https://fixture.r2.cloudflarestorage.com',
    R2_BUCKET: 'fixture',
    AWS_ACCESS_KEY_ID: 'fixture',
    AWS_SECRET_ACCESS_KEY: 'fixture',
    AGE_IDENTITY_FILE: identity,
    RESTORE_DATABASE_URL: targetUrl.href,
  };
  run('node', ['scripts/deploy/backup.mjs'], env);
  const firstMonthly = Object.entries(
    JSON.parse(readFileSync(storage, 'utf8')),
  ).find(([key]) => key.startsWith('monthly/'))[1].body;
  run('node', ['scripts/deploy/backup.mjs'], env);
  const secondMonthly = Object.entries(
    JSON.parse(readFileSync(storage, 'utf8')),
  ).find(([key]) => key.startsWith('monthly/'))[1].body;
  assert.equal(secondMonthly, firstMonthly);
  run('node', ['scripts/deploy/restore-drill.mjs'], env);
  await target.connect();
  const { rows } = await target.query(
    "SELECT bytes FROM invoices.artifacts WHERE key = 'fixture'",
  );
  assert.equal(rows[0].bytes, 'JVBERi0xLjQ=');
  assert.throws(() => run('node', ['scripts/deploy/restore-drill.mjs'], env));
  console.log(
    'Local PostgreSQL backup and restore passed. Artifact bytes match. Repeat restore refused.',
  );
} finally {
  await source.end();
  await target.end();
  if (createdSource)
    await admin.query(`DROP DATABASE ${sourceName} WITH (FORCE)`);
  if (createdTarget)
    await admin.query(`DROP DATABASE ${targetName} WITH (FORCE)`);
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
}

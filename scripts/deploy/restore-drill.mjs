import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  Client,
  checkClient,
  clientMajor,
  inventory,
  objects,
  pgEnv,
  required,
  root,
  run,
  s3,
  scratchUrl,
} from './ops.mjs';

async function main() {
  process.umask(0o077);
  const url = scratchUrl(required('RESTORE_DATABASE_URL'));
  const identity = resolve(required('AGE_IDENTITY_FILE'));
  const dir = mkdtempSync(join(root, '.restore-'));
  chmodSync(dir, 0o700);
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 30_000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname IN ('invoices', 'auth', 'drizzle')",
    );
    if (rows.length)
      throw new Error(
        'Use an empty scratch database. The restore never deletes an existing schema.',
      );
    const major = await clientMajor(client);
    checkClient(major);
    const encrypted = join(dir, 'backup.tar.gz.age');
    if (process.env.BACKUP_FILE) {
      run('cp', [resolve(process.env.BACKUP_FILE), encrypted]);
    } else {
      const latest = objects()
        .filter((item) =>
          /^(daily\/\d{4}-\d{2}-\d{2}|monthly\/\d{4}-\d{2})\.tar\.gz\.age$/.test(
            item.Key,
          ),
        )
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))[0];
      if (!latest) throw new Error('No backup exists in R2.');
      s3([
        's3api',
        'get-object',
        '--bucket',
        required('R2_BUCKET'),
        '--key',
        latest.Key,
        encrypted,
      ]);
    }
    const archive = join(dir, 'backup.tar.gz');
    run('age', [
      '--decrypt',
      '--identity',
      identity,
      '--output',
      archive,
      encrypted,
    ]);
    assert.deepEqual(run('tar', ['-tzf', archive]).trim().split('\n').sort(), [
      'database.dump',
      'manifest.json',
    ]);
    if (
      run('tar', ['-tvzf', archive])
        .trim()
        .split('\n')
        .some((line) => !line.startsWith('-'))
    ) {
      throw new Error('The backup contains a non-file archive entry.');
    }
    run('tar', ['-xzf', archive, '-C', dir, '--no-same-owner']);
    const manifest = JSON.parse(
      readFileSync(join(dir, 'manifest.json'), 'utf8'),
    );
    assert.equal(manifest.version, 1);
    assert.equal(
      manifest.major,
      major,
      'Use the same PostgreSQL major as the backup.',
    );
    run(
      'pg_restore',
      [
        '--exit-on-error',
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--dbname',
        pgEnv(url).PGDATABASE,
        join(dir, 'database.dump'),
      ],
      { env: pgEnv(url) },
    );
    const actual = await inventory(client);
    assert.deepEqual(actual, {
      counts: manifest.counts,
      columns: manifest.columns,
      ledgers: manifest.ledgers,
    });
    run('bun', ['run', 'db:check']);
    for (const [table, count] of Object.entries(actual.counts))
      console.log(`${table}: ${count} rows`);
    console.log(
      'Restore drill complete. Schema, row counts, and migration ledgers match the snapshot.',
    );
  } finally {
    await client.end();
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(() => {
  console.error(
    'Restore drill failed. Check the identity, backup, client major, and empty scratch database. No row data was logged.',
  );
  process.exitCode = 1;
});

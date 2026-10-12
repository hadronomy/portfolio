import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import {
  Client,
  checkClient,
  clientMajor,
  directUrl,
  inventory,
  OperatorError,
  objects,
  pgEnv,
  required,
  retentionPlan,
  root,
  run,
  s3,
} from './ops.mjs';

async function main() {
  process.umask(0o077);
  const recipients = process.env.BACKUP_RECIPIENTS_FILE
    ? resolve(process.env.BACKUP_RECIPIENTS_FILE)
    : join(root, 'docs/deploy/backup-recipients.txt');
  if (
    !readFileSync(recipients, 'utf8')
      .split('\n')
      .some((line) => /^age1[0-9a-z]+$/.test(line.trim()))
  ) {
    throw new OperatorError(
      "Commit the owner's age public recipient before the backup.",
    );
  }
  const url = directUrl(required('DATABASE_URL_UNPOOLED'));
  const dir = mkdtempSync(join(root, '.backup-'));
  chmodSync(dir, 0o700);
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 30_000,
  });
  try {
    await client.connect();
    const major = await clientMajor(client);
    checkClient(major);
    const { rows: sizes } = await client.query(
      'SELECT pg_database_size(current_database())::text AS bytes',
    );
    // Daily full dumps must also fit Neon's five GB monthly egress allowance.
    if (Number(sizes[0].bytes) * 32 > 4_000_000_000)
      throw new OperatorError(
        'The database exceeds the free Neon backup egress budget. Archive records offline.',
      );
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows } = await client.query(
      'SELECT pg_export_snapshot() AS snapshot',
    );
    const snapshot = await inventory(client);
    run(
      'pg_dump',
      [
        '--format=custom',
        '--compress=0',
        '--no-owner',
        '--no-acl',
        '--schema=invoices',
        '--schema=auth',
        '--schema=drizzle',
        '--strict-names',
        `--snapshot=${rows[0].snapshot}`,
        '--file',
        join(dir, 'database.dump'),
      ],
      { env: pgEnv(url) },
    );
    await client.query('COMMIT');
    writeFileSync(
      join(dir, 'manifest.json'),
      `${JSON.stringify({ version: 1, major, createdAt: new Date().toISOString(), ...snapshot })}\n`,
    );
    run('tar', [
      '-czf',
      join(dir, 'backup.tar.gz'),
      '-C',
      dir,
      'database.dump',
      'manifest.json',
    ]);
    const archive = join(dir, 'backup.tar.gz.age');
    run('age', [
      '--encrypt',
      '--recipients-file',
      recipients,
      '--output',
      archive,
      join(dir, 'backup.tar.gz'),
    ]);
    const plan = retentionPlan(objects(), statSync(archive).size);
    // Complete the new backup before deleting any expired daily copy.
    for (const key of [
      plan.daily,
      ...(plan.addMonthly ? [plan.monthly] : []),
    ]) {
      s3([
        's3api',
        'put-object',
        '--bucket',
        required('R2_BUCKET'),
        '--key',
        key,
        '--body',
        archive,
        '--storage-class',
        'STANDARD',
      ]);
    }
    for (const item of plan.expired)
      s3([
        's3api',
        'delete-object',
        '--bucket',
        required('R2_BUCKET'),
        '--key',
        item.Key,
      ]);
    console.log(
      `Encrypted backup complete. R2 retention uses ${plan.total} bytes.`,
    );
  } finally {
    await client.end();
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(
    error instanceof OperatorError
      ? error.message
      : 'Backup failed. Check database and R2 credentials.',
  );
  process.exitCode = 1;
});

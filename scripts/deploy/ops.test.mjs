import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directUrl, pgEnv, retentionPlan, run, scratchUrl } from './ops.mjs';
import { migrationUrl } from './vercel-build.mjs';

test('preview builds never acquire a production migration URL', () => {
  assert.equal(
    migrationUrl({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      DATABASE_URL_UNPOOLED: 'invalid',
    }),
    undefined,
  );
  assert.throws(() => migrationUrl({}));
});

test('production migrations require Vercel variables, a direct URL, and TLS', () => {
  const env = {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    DATABASE_URL:
      'postgres://user:password@ep-host-pooler.neon.tech/db?sslmode=require',
  };
  assert.throws(() => migrationUrl(env));
  assert.throws(() =>
    migrationUrl({
      ...env,
      DATABASE_URL_UNPOOLED:
        'postgres://user:password@ep-host-pooler.neon.tech/db?sslmode=require',
    }),
  );
  assert.throws(() =>
    migrationUrl({
      ...env,
      DATABASE_URL_UNPOOLED: 'postgres://user:password@ep-host.neon.tech/db',
    }),
  );
  const value = 'postgres://user:password@ep-host.neon.tech/db?sslmode=require';
  assert.throws(() =>
    migrationUrl({
      ...env,
      DATABASE_URL_UNPOOLED: value,
      DATABASE_URL:
        'postgres://user:password@other-pooler.neon.tech/db?sslmode=require',
    }),
  );
  assert.throws(() =>
    migrationUrl({
      ...env,
      DATABASE_URL_UNPOOLED: value,
      VERCEL_ENV: 'unknown',
    }),
  );
  assert.equal(migrationUrl({ ...env, DATABASE_URL_UNPOOLED: value }), value);
  assert.throws(() =>
    migrationUrl({ ...env, VERCEL: '', DATABASE_URL_UNPOOLED: value }),
  );
});

test('database credentials stay in the child environment', () => {
  const env = pgEnv('postgres://a%40b:p%3Aword@host:5433/db?sslmode=require');
  assert.equal(env.PGUSER, 'a@b');
  assert.equal(env.PGPASSWORD, 'p:word');
  assert.equal(env.PGDATABASE, 'db');
  assert.equal(env.PGPORT, '5433');
  assert.throws(() => directUrl('postgres://user:password@host-pooler/db'));
});

test('the restore refuses production hosts and existing app database names', () => {
  assert.throws(() =>
    scratchUrl('postgres://user:password@ep-host.neon.tech/db'),
  );
  assert.throws(() =>
    scratchUrl('postgres://user:password@localhost/invoices'),
  );
  const value =
    'postgres://user:password@127.0.0.1/portfolio_restore_1?sslmode=disable';
  assert.equal(scratchUrl(value), value);
});

test('retention prunes daily copies after 30 days and preserves all monthly copies', () => {
  const now = new Date('2026-10-12T02:23:00Z');
  const items = [
    { Key: 'daily/2026-09-12.tar.gz.age', Size: 10 },
    { Key: 'daily/2026-10-11.tar.gz.age', Size: 10 },
    { Key: 'monthly/2018-01.tar.gz.age', Size: 10 },
  ];
  const plan = retentionPlan(items, 20, now);
  assert.equal(plan.expired.length, 1);
  assert.equal(plan.expired[0].Key, items[0].Key);
  assert.equal(plan.monthly, 'monthly/2026-10.tar.gz.age');
  assert.equal(plan.total, 60);
  assert.equal(plan.addMonthly, true);
});

test('a repeat keeps the first monthly snapshot and replaces only today', () => {
  const plan = retentionPlan(
    [
      { Key: 'monthly/2026-10.tar.gz.age', Size: 10 },
      { Key: 'daily/2026-10-12.tar.gz.age', Size: 10 },
    ],
    20,
    new Date('2026-10-12T02:23:00Z'),
  );
  assert.equal(plan.addMonthly, false);
  assert.equal(plan.total, 30);
});

test('storage checks cover the whole bucket and seven years of archive growth', () => {
  assert.throws(() => retentionPlan([], 80_000_000));
  assert.throws(() =>
    retentionPlan([{ Key: 'other', Size: 9_000_000_000 }], 1),
  );
  assert.doesNotThrow(() => retentionPlan([], 70_000_000));
});

test('subprocess errors never expose row data', () => {
  assert.throws(
    () =>
      run('node', [
        '-e',
        "process.stderr.write('private-row'); process.exit(1)",
      ]),
    (error) => !error.message.includes('private-row'),
  );
});

test('the upload budget includes expired copies until the new backup succeeds', () => {
  assert.throws(() =>
    retentionPlan(
      [{ Key: 'daily/2000-01-01.tar.gz.age', Size: 9_000_000_000 }],
      1,
    ),
  );
});

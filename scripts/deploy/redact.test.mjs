import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspect } from 'node:util';
import { redactDatabase } from './redact.mjs';
import { runDeployCommand } from './vercel-build.mjs';

const env = {
  DATABASE_URL:
    'postgres://user:p%3Ass%40word@ep-host-pooler.neon.tech/db?sslmode=require',
  DATABASE_URL_UNPOOLED:
    'postgresql://user:direct-secret@ep-host.neon.tech/db?sslmode=require',
};

test('database URLs and encoded or decoded passwords are redacted', () => {
  const log = `${env.DATABASE_URL}\n${env.DATABASE_URL_UNPOOLED}\np%3Ass%40word p:ss@word direct-secret`;
  const result = redactDatabase(log, env);
  assert.equal(
    result,
    '[REDACTED_DATABASE_URL]\n[REDACTED_DATABASE_URL]\n[REDACTED] [REDACTED] [REDACTED]',
  );
  assert.equal(
    redactDatabase('error: postgres://other:new-secret@host/db', env),
    'error: [REDACTED_DATABASE_URL]',
  );
});

test('URL parser errors and nested causes retain diagnostics without credentials', () => {
  const invalid = 'not-a-url-direct-secret';
  let cause;
  try {
    new URL(invalid);
  } catch (error) {
    cause = error;
  }
  const error = new Error('Auth migration failed: relation does not exist', {
    cause,
  });
  const result = redactDatabase(inspect(error), {
    ...env,
    DATABASE_URL_UNPOOLED: invalid,
  });
  assert.match(result, /relation does not exist/);
  assert.match(result, /ERR_INVALID_URL/);
  assert.ok(!result.includes(invalid));
  assert.equal(redactDatabase('migration complete', {}), 'migration complete');
});

test('deploy output streams before exit and redacts secrets split across chunks', async () => {
  let stdout = '';
  let stderr = '';
  let complete = false;
  let sawProgress = false;
  const child = `
    console.log('migration started');
    process.stderr.write('missing relation: ' + process.env.DATABASE_URL.slice(0, 25));
    setTimeout(() => {
      process.stderr.write(process.env.DATABASE_URL.slice(25) + '\\n');
      process.stdout.write('password: p:ss');
      setTimeout(() => {
        process.stdout.write('@word\\n');
        process.exit(7);
      }, 30);
    }, 30);
  `;
  const command = runDeployCommand(
    process.execPath,
    ['-e', child],
    { ...process.env, ...env },
    {
      stdout: {
        write: (line) => {
          stdout += line;
          if (line.includes('migration started')) sawProgress = !complete;
        },
      },
      stderr: {
        write: (line) => {
          stderr += line;
        },
      },
    },
  );
  await assert.rejects(command, /failed \(7\)/);
  complete = true;
  assert.ok(sawProgress);
  assert.equal(stdout, 'migration started\npassword: [REDACTED]\n');
  assert.equal(stderr, 'missing relation: [REDACTED_DATABASE_URL]\n');
});

test('a failed executable reports the original operating-system error', async () => {
  await assert.rejects(
    runDeployCommand('/missing/portfolio-deploy-command', [], env),
    (error) => error.code === 'ENOENT',
  );
});

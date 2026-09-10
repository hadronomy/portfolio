import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applicationOrigin } from './features/invoices/origin.server.ts';

test('OAuth callback keeps the public origin through the Astro development proxy', () => {
  const signIn = new Request('http://127.0.0.1:4343/_apps/functions/sign-in', {
    headers: { host: '127.0.0.1:4343' },
  });
  const callback = new Request(
    'http://127.0.0.1:49419/invoices/auth/callback',
    {
      headers: {
        host: '127.0.0.1:49419',
        'x-forwarded-host': '127.0.0.1:4343',
      },
    },
  );
  assert.equal(
    applicationOrigin(signIn, { production: false }),
    'http://127.0.0.1:4343',
  );
  assert.equal(
    applicationOrigin(callback, { production: false }),
    applicationOrigin(signIn, { production: false }),
  );
});

test('production ignores request host and forwarded host', () => {
  const request = new Request('https://internal.example/invoices', {
    headers: {
      host: 'attacker.example',
      'x-forwarded-host': 'attacker.example',
    },
  });
  assert.equal(
    applicationOrigin(request, { production: true }),
    'https://hadronomy.com',
  );
});

test('local OAuth rejects non-loopback host headers', () => {
  const request = new Request('http://127.0.0.1:49419/invoices', {
    headers: { host: 'attacker.example:4343' },
  });
  assert.throws(() => applicationOrigin(request, { production: false }));
});

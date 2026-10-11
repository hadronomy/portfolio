import { expect, test } from 'vitest';
import { applicationOrigin } from './origin.server';

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
  expect(applicationOrigin(signIn, { production: false })).toBe(
    'http://127.0.0.1:4343',
  );
  expect(applicationOrigin(callback, { production: false })).toBe(
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
  expect(applicationOrigin(request, { production: true })).toBe(
    'https://hadronomy.com',
  );
});

test('local OAuth rejects non-loopback host headers', () => {
  const request = new Request('http://127.0.0.1:49419/invoices', {
    headers: { host: 'attacker.example:4343' },
  });
  expect(() => applicationOrigin(request, { production: false })).toThrow();
});

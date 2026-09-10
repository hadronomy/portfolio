import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dev } from 'astro';

const root = new URL('../', import.meta.url);
let server;
let invoiceData;
let origin;
const invoiceEnvironment = Object.fromEntries(
  ['INVOICE_DATA_DIRECTORY', 'DATABASE_URL', 'INVOICE_SECRET'].map((key) => [
    key,
    process.env[key],
  ]),
);
let sessionCookie = '';

before(async () => {
  invoiceData = await mkdtemp(join(tmpdir(), 'portfolio-visual-test-'));
  process.env.INVOICE_DATA_DIRECTORY = invoiceData;
  delete process.env.DATABASE_URL;
  delete process.env.INVOICE_SECRET;
  server = await dev({
    root,
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  origin = `http://127.0.0.1:${server.address.port}`;
});

after(async () => {
  await server?.stop();
  if (globalThis.invoiceRuntime)
    await (await globalThis.invoiceRuntime).database.close();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  for (const [key, value] of Object.entries(invoiceEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('sign in as owner for visual SSR check', async (t) => {
  const requireStart = createRequire(
    new URL('../../start/package.json', import.meta.url),
  );
  const { NodeOAuthClient } = await import(
    pathToFileURL(requireStart.resolve('@atproto/oauth-client-node')).href
  );
  t.mock.method(NodeOAuthClient.prototype, 'callback', async () => ({
    session: { did: 'did:plc:tvgjv46t4ebxbrvekr2vrnls' },
    state: 'visual-nonce',
  }));
  const response = await fetch(`${origin}/invoices/auth/callback?state=test`, {
    headers: { cookie: 'invoice-login=visual-nonce' },
    redirect: 'manual',
  });
  assert.equal(response.status, 303);
  const session = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('invoice-session='));
  assert.ok(session);
  sessionCookie = session.split(';')[0];
});

const routes = [
  ['/invoices', 'Invoice workspace'],
  ['/invoices/customers', 'iv-directory'],
  ['/invoices/items', 'iv-directory'],
  // Settings and the invoice detail gate on the client workspace query, so SSR
  // shows their loading states; the form itself renders after hydration.
  ['/invoices/settings', 'iv-preview-message'],
  ['/invoices/00000000-0000-4000-8000-000000000000', 'iv-preview-message'],
];

for (const [path, marker] of routes) {
  test(`SSR ${path} renders without crashing`, async () => {
    let html = '';
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(`${origin}${path}`, {
        headers: { cookie: sessionCookie },
      });
      status = response.status;
      html = await response.text();
      if (status === 200 && new RegExp(marker).test(html)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(status, 200);
    assert.match(html, new RegExp(marker), `${path} missing marker ${marker}`);
  });
}

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dev } from 'astro';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { signIn } from './owner.mjs';

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

beforeAll(async () => {
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

afterAll(async () => {
  await server?.stop();
  await globalThis.invoiceRuntime?.dispose();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  for (const [key, value] of Object.entries(invoiceEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('sign in as owner for visual SSR check', async () => {
  const signedIn = await signIn(origin);
  expect(signedIn.response.status).toBe(302);
  expect(signedIn.cookie).toBeTruthy();
  sessionCookie = signedIn.cookie;
});

const routes = [
  ['/invoices', 'Invoice workspace'],
  ['/invoices/customers', 'iv-rows'],
  ['/invoices/items', 'iv-rows'],
  // Settings and the invoice detail gate on the client workspace query, so SSR
  // shows their loading states; the form itself renders after hydration.
  ['/invoices/settings', 'iv-message'],
  ['/invoices/00000000-0000-4000-8000-000000000000', 'iv-message'],
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
    expect(status).toBe(200);
    expect(html, `${path} missing marker ${marker}`).toMatch(
      new RegExp(marker),
    );
  });
}

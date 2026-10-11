import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dev } from 'astro';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const root = new URL('../', import.meta.url);
const requireInvoices = createRequire(
  new URL('../../../packages/invoices/package.json', import.meta.url),
);
const { PGlite } = await import(
  pathToFileURL(requireInvoices.resolve('@electric-sql/pglite')).href
);
const { drizzle } = await import(
  pathToFileURL(requireInvoices.resolve('drizzle-orm/pglite')).href
);
const tables = await import('../../../packages/invoices/src/tables.ts');
const model = await import('../../../packages/invoices/src/model.ts');
const { Schema } = await import(
  pathToFileURL(requireInvoices.resolve('effect')).href
);

let server;
let invoiceData;
let origin;
let sessionCookie = '';
let invoiceId = '';

beforeAll(async () => {
  invoiceData = await mkdtemp(join(tmpdir(), 'portfolio-pdf-test-'));
  const migration = await readFile(
    new URL(
      '../../../packages/invoices/src/migrations/0001.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const draft = model.newInvoice();
  const invoice = {
    ...draft,
    data: {
      ...draft.data,
      title: 'Download check',
      lines: [
        {
          ...model.newLine(),
          description: 'Test line',
          quantity: '1',
          unitPrice: '100',
        },
      ],
    },
  };
  Schema.decodeUnknownSync(model.Invoice)(invoice);
  const seed = new PGlite(join(invoiceData, 'postgres'));
  await seed.exec(migration);
  const db = drizzle(seed, { schema: tables });
  await db.insert(tables.invoices).values({
    id: invoice.id,
    status: 'draft',
    revision: 1,
    payload: invoice,
    updatedAt: new Date().toISOString(),
  });
  const check = await db.select().from(tables.invoices);
  expect(check.length).toBe(1);
  await seed.close();
  invoiceId = invoice.id;
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
  if (globalThis.invoiceRuntime)
    await (await globalThis.invoiceRuntime).database.close();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  delete process.env.INVOICE_DATA_DIRECTORY;
});

test('sign in as owner for PDF download check', async () => {
  const requireStart = createRequire(
    new URL('../../start/package.json', import.meta.url),
  );
  const { NodeOAuthClient } = await import(
    pathToFileURL(requireStart.resolve('@atproto/oauth-client-node')).href
  );
  vi.spyOn(NodeOAuthClient.prototype, 'callback').mockImplementation(
    async () => ({
      session: { did: 'did:plc:tvgjv46t4ebxbrvekr2vrnls' },
      state: 'pdf-nonce',
    }),
  );
  const response = await fetch(`${origin}/invoices/auth/callback?state=test`, {
    headers: { cookie: 'invoice-login=pdf-nonce' },
    redirect: 'manual',
  });
  expect(response.status).toBe(303);
  sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('invoice-session='))
    .split(';')[0];
});

test('draft PDF downloads with PDF bytes', async () => {
  const response = await fetch(`${origin}/invoices/pdf/${invoiceId}?lang=en`, {
    headers: { cookie: sessionCookie },
  });
  const body = Buffer.from(await response.arrayBuffer());
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type') ?? '').toMatch(
    /application\/pdf/,
  );
  expect(body.slice(0, 8).toString('utf8')).toMatch(/^%PDF/);
  expect(body.length > 5000).toBeTruthy();
});

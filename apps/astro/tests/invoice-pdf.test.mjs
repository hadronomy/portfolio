import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dev } from 'astro';

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

before(async () => {
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
  assert.equal(check.length, 1);
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

after(async () => {
  await server?.stop();
  if (globalThis.invoiceRuntime)
    await (await globalThis.invoiceRuntime).database.close();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  delete process.env.INVOICE_DATA_DIRECTORY;
});

test('sign in as owner for PDF download check', async (t) => {
  const requireStart = createRequire(
    new URL('../../start/package.json', import.meta.url),
  );
  const { NodeOAuthClient } = await import(
    pathToFileURL(requireStart.resolve('@atproto/oauth-client-node')).href
  );
  t.mock.method(NodeOAuthClient.prototype, 'callback', async () => ({
    session: { did: 'did:plc:tvgjv46t4ebxbrvekr2vrnls' },
    state: 'pdf-nonce',
  }));
  const response = await fetch(`${origin}/invoices/auth/callback?state=test`, {
    headers: { cookie: 'invoice-login=pdf-nonce' },
    redirect: 'manual',
  });
  assert.equal(response.status, 303);
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
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/pdf/);
  assert.match(body.slice(0, 8).toString('utf8'), /^%PDF/);
  assert.ok(body.length > 5000);
});

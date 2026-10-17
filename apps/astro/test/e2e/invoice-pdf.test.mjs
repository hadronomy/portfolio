import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgresLocal } from '@portfolio/database/local';
import { databaseLayer } from '@portfolio/invoices/database';
import { migrations } from '@portfolio/invoices/migrations';
import * as model from '@portfolio/invoices/model';
import { InvoiceStore, storeLayer } from '@portfolio/invoices/store';
import { dev } from 'astro';
import { Effect, Layer, Schema } from 'effect';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { signIn } from '#support/owner.mjs';

const root = new URL('../../', import.meta.url);

let server;
let invoiceData;
let origin;
let sessionCookie = '';
let invoiceId = '';

beforeAll(async () => {
  invoiceData = await mkdtemp(join(tmpdir(), 'portfolio-pdf-test-'));
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
  // Seeded through the store, on the migrations a running server applies,
  // so the database is exactly the one the dev server opens next.
  await Effect.runPromise(
    InvoiceStore.use((store) =>
      store.save(
        invoice,
        model.OwnerDid.make('did:plc:tvgjv46t4ebxbrvekr2vrnls'),
      ),
    ).pipe(
      Effect.provide(
        storeLayer.pipe(
          Layer.provideMerge(databaseLayer),
          Layer.provideMerge(
            PostgresLocal.layer({
              directory: join(invoiceData, 'pglite'),
              migrations: [migrations],
            }),
          ),
        ),
      ),
    ),
  );
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
  await globalThis.invoiceRuntime?.dispose();
  delete globalThis.invoiceRuntime;
  if (invoiceData) await rm(invoiceData, { recursive: true, force: true });
  delete process.env.INVOICE_DATA_DIRECTORY;
});

test('sign in as owner for PDF download check', async () => {
  const signedIn = await signIn(origin);
  expect(signedIn.response.status).toBe(302);
  expect(signedIn.cookie).toBeTruthy();
  sessionCookie = signedIn.cookie;
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
  expect(body.subarray(0, 8).toString('utf8')).toMatch(/^%PDF/);
  expect(body.length > 5000).toBeTruthy();
});

import { InvoiceDatabase } from '@portfolio/invoices/database';
import { Documents, type DocumentsApi } from '@portfolio/invoices/documents';
import { specimen } from '@portfolio/invoices/fixtures';
import { OwnerDid } from '@portfolio/invoices/model';
import { InvoiceStore, type StoreApi } from '@portfolio/invoices/store';
import { testRuntime } from '@portfolio/invoices/testing';
import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runtime = testRuntime();
let store: StoreApi;
let documents: DocumentsApi;
const owner = OwnerDid.make('owner');
const run = Effect.runPromise;
const kept = () =>
  runtime.runPromise(
    Effect.flatMap(Effect.service(InvoiceDatabase), (db) =>
      db.query.artifacts.findMany(),
    ),
  );

beforeAll(async () => {
  store = await runtime.runPromise(Effect.service(InvoiceStore));
  documents = await runtime.runPromise(Effect.service(Documents));
}, 20000);
afterAll(() => runtime.dispose());

describe('documents', () => {
  it('renders an issued invoice once and serves the same bytes after', async () => {
    const draft = await run(store.save(specimen(), owner));
    const issued = await run(
      store.issue(
        { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
        owner,
      ),
    );
    const first = await run(documents.pdf(issued.id, 'en'));
    const again = await run(documents.pdf(issued.id, 'en'));
    expect(Buffer.from(again.bytes).equals(Buffer.from(first.bytes))).toBe(
      true,
    );
    expect(await run(documents.preview(issued))).toEqual(again.bytes);
    expect(
      (await kept()).filter((row) => row.invoiceId === issued.id),
    ).toHaveLength(1);
  }, 60000);

  it('renders drafts fresh and keeps nothing', async () => {
    const draft = await run(store.save(specimen(), owner));
    const bytes = await run(documents.preview(draft));
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect((await kept()).some((row) => row.invoiceId === draft.id)).toBe(
      false,
    );
  }, 60000);
});

it('appends to the accepted artifact without changing its page content', async () => {
  const { quoteSpecimen } = await import('@portfolio/invoices/fixtures');
  const { QuoteResponse } = await import('@portfolio/invoices/quote-model');
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const { createRequire } = await import('node:module');
  const { PdfiumNative } = await import('@embedpdf/engines/pdfium');
  const { init } = await import('@embedpdf/pdfium');
  const specimen = quoteSpecimen();
  const draft = await run(
    store.save(
      {
        ...specimen,
        data: {
          ...specimen.data,
          quote: specimen.data.quote && {
            ...specimen.data.quote,
            validUntil: '2099-12-31',
          },
        },
      },
      owner,
    ),
  );
  const quote = await run(
    store.issue(
      { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
      owner,
    ),
  );
  const original = await run(documents.pdf(quote.id, 'en'));
  const digest = createHash('sha256').update(original.bytes).digest('hex');
  const response = QuoteResponse.make({
    quoteId: quote.id,
    outcome: 'accepted',
    name: 'Lucy Martin',
    email: quote.data.customer.email,
    earlyStart: true,
    language: 'en',
    digest,
    plan: null,
    signature:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96" width="240" height="96"><path d="M10 20 Q12 22 14 21 16 18 10 20 Z" fill="#1d3fae"/></svg>',
    address: '203.0.113.7',
    agent: 'test',
    decidedAt: new Date().toISOString(),
    confirmedAt: null,
    billed: [],
  });
  // Even a different in-memory invoice cannot change the accepted pages.
  const signed = await run(
    documents.signed(
      { ...quote, data: { ...quote.data, title: 'Changed later', lines: [] } },
      response,
    ),
  );
  expect(createHash('sha256').update(original.bytes).digest('hex')).toBe(
    response.digest,
  );
  expect(Buffer.from(signed.subarray(0, original.bytes.length))).toEqual(
    Buffer.from(original.bytes),
  );
  const require = createRequire(import.meta.url);
  const engine = new PdfiumNative(
    await init({
      wasmBinary: await readFile(
        require.resolve('@embedpdf/pdfium/pdfium.wasm'),
      ),
    }),
  );
  const first = await engine
    .openDocumentBuffer({
      id: 'accepted',
      content: original.bytes.slice().buffer,
    })
    .toPromise();
  const copy = await engine
    .openDocumentBuffer({ id: 'signed', content: signed.slice().buffer })
    .toPromise();
  try {
    expect(copy.pageCount).toBe(first.pageCount + 1);
    for (const page of first.pages) {
      const appended = copy.pages[page.index];
      if (!appended) throw new Error('Missing accepted page');
      expect(await engine.extractText(copy, [page.index]).toPromise()).toBe(
        await engine.extractText(first, [page.index]).toPromise(),
      );
      const before = await engine
        .renderPageRaw(first, page, { scaleFactor: 1 })
        .toPromise();
      const after = await engine
        .renderPageRaw(copy, appended, { scaleFactor: 1 })
        .toPromise();
      expect(
        Buffer.from(after.data.buffer).equals(Buffer.from(before.data.buffer)),
      ).toBe(true);
    }
    expect(
      await engine.extractText(copy, [first.pageCount]).toPromise(),
    ).toContain('Lucy Martin');
  } finally {
    await engine.closeDocument(first).toPromise();
    await engine.closeDocument(copy).toPromise();
    await engine.destroy().toPromise();
  }
  expect(await run(documents.signed(quote, response))).toEqual(signed);
  expect(
    await run(
      Effect.flip(
        documents.signed(quote, { ...response, digest: '0'.repeat(64) }),
      ),
    ),
  ).toMatchObject({ _tag: 'AcceptedPdfMismatch' });
  const db = await runtime.runPromise(InvoiceDatabase);
  const { eq } = await import('drizzle-orm');
  const { artifacts } = await import('@portfolio/invoices/tables');
  await runtime.runPromise(
    db
      .update(artifacts)
      .set({ bytes: Buffer.from('changed').toString('base64') })
      .where(eq(artifacts.key, `${quote.id}:${quote.revision}:en`)),
  );
  expect(
    await run(Effect.flip(documents.signed(quote, response))),
  ).toMatchObject({ _tag: 'AcceptedPdfMismatch' });
}, 60_000);

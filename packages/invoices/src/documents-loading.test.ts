import { Effect } from 'effect';
import { afterAll, expect, it, vi } from 'vitest';
import { InvoiceDatabase } from './database';
import { Documents } from './documents';
import { specimen } from './fixtures';
import { OwnerDid } from './model';
import { InvoiceStore } from './store';
import * as tables from './tables';
import { testRuntime } from './testing';

vi.mock('./pdf', () => {
  throw new Error('A stored PDF does not need the renderer.');
});

const runtime = testRuntime();
afterAll(() => runtime.dispose());

it('serves a stored PDF while the renderer is unavailable', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7 stored artifact');
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* InvoiceStore;
      const db = yield* InvoiceDatabase;
      const documents = yield* Documents;
      const owner = OwnerDid.make('owner');
      const draft = yield* store.save(specimen(), owner);
      const invoice = yield* store.issue(
        { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
        owner,
      );
      yield* db.insert(tables.artifacts).values({
        key: `${invoice.id}:${invoice.revision}:en`,
        invoiceId: invoice.id,
        language: 'en',
        bytes: Buffer.from(bytes).toString('base64'),
        digest: '0'.repeat(64),
        createdAt: new Date().toISOString(),
      });
      return yield* documents.pdf(invoice.id, 'en');
    }),
  );
  expect(Buffer.from(result.bytes).equals(Buffer.from(bytes))).toBe(true);
}, 20_000);

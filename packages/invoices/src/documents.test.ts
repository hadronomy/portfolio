import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InvoiceDatabase } from './database';
import { Documents, type DocumentsApi } from './documents';
import { specimen } from './fixtures';
import { OwnerDid } from './model';
import { InvoiceStore, type StoreApi } from './store';
import { testRuntime } from './testing';

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

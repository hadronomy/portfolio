import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, openDatabase } from './database';
import { specimen } from './fixtures';
import { OwnerDid, RecordId } from './model';
import { makeStore, type StoreApi } from './store';

let database: Database;
let store: StoreApi;
const owner = OwnerDid.make('owner');
beforeAll(async () => {
  database = await openDatabase();
  store = makeStore(database);
}, 20000);
afterAll(async () => database?.close());
const run = Effect.runPromise;
describe('persistent invoices', () => {
  it('saves drafts and rejects a stale revision', async () => {
    const draft = specimen();
    const first = await run(store.save(draft, owner));
    const second = await run(
      store.save(
        { ...first, data: { ...first.data, title: 'Updated' } },
        owner,
      ),
    );
    expect(second.revision).toBe(2);
    const exit = await run(Effect.result(store.save(first, owner)));
    expect(exit._tag).toBe('Failure');
    expect((await run(store.read(first.id))).data.title).toBe('Updated');
  });
  it('issues once when the same request is retried', async () => {
    const draft = await run(store.save(specimen(), owner));
    const input = {
      id: draft.id,
      revision: draft.revision,
      key: crypto.randomUUID(),
    };
    const issued = await run(store.issue(input, owner));
    const retry = await run(store.issue(input, owner));
    expect(retry).toEqual(issued);
    expect(issued.number).toMatch(/^INV-2026-\d{4}$/);
    expect(issued.status).toBe('issued');
  });
  it('rejects edits and deletion after issue', async () => {
    const draft = await run(store.save(specimen(), owner));
    const issued = await run(
      store.issue(
        { id: draft.id, revision: 1, key: crypto.randomUUID() },
        owner,
      ),
    );
    expect(
      (
        await run(
          Effect.result(
            store.save(
              { ...issued, status: 'draft', number: null, issuedAt: null },
              owner,
            ),
          ),
        )
      )._tag,
    ).toBe('Failure');
    expect(
      (await run(Effect.result(store.remove(issued.id, owner))))._tag,
    ).toBe('Failure');
    expect(await run(store.read(issued.id))).toEqual(issued);
  });
  it('separates proforma numbers from invoice numbers', async () => {
    const draft = specimen();
    const proforma = await run(
      store.save(
        { ...draft, data: { ...draft.data, kind: 'proforma' } },
        owner,
      ),
    );
    expect(
      (
        await run(
          store.issue(
            { id: proforma.id, revision: 1, key: crypto.randomUUID() },
            owner,
          ),
        )
      ).number,
    ).toMatch(/^P-INV-/);
  });
  it('records partial payment and retains a reversed payment', async () => {
    const draft = await run(store.save(specimen(), owner));
    const invoice = await run(
      store.issue(
        { id: draft.id, revision: 1, key: crypto.randomUUID() },
        owner,
      ),
    );
    const payment = {
      id: RecordId.make(crypto.randomUUID()),
      invoiceId: invoice.id,
      amount: '100',
      date: '2026-09-10',
      method: 'transfer' as const,
      reference: 'Bank reference',
      createdAt: '',
      reversedAt: null,
    };
    await run(store.payment(payment, owner));
    await run(store.reversePayment(payment.id, owner));
    const saved = (await run(store.workspace())).payments.find(
      (p) => p.id === payment.id,
    );
    expect(saved?.reversedAt).toBeTruthy();
  });
  it('retains issuer snapshots after changing preferences', async () => {
    const draft = await run(store.save(specimen(), owner));
    const original = await run(
      store.issue(
        { id: draft.id, revision: 1, key: crypto.randomUUID() },
        owner,
      ),
    );
    const workspace = await run(store.workspace());
    await run(
      store.preferences({
        ...workspace.preferences,
        issuer: { ...workspace.preferences.issuer, name: 'Another name' },
      }),
    );
    expect((await run(store.read(original.id))).data.issuer.name).toBe(
      'Estudio Ejemplo',
    );
  });
});

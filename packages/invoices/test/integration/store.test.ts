import { specimen } from '@portfolio/invoices/fixtures';
import { asQuote, OwnerDid, RecordId } from '@portfolio/invoices/model';
import { inFull, noOffer } from '@portfolio/invoices/plan';
import { InvoiceStore, type StoreApi } from '@portfolio/invoices/store';
import { testRuntime } from '@portfolio/invoices/testing';
import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runtime = testRuntime();
let store: StoreApi;
const owner = OwnerDid.make('owner');
beforeAll(async () => {
  store = await runtime.runPromise(Effect.service(InvoiceStore));
}, 20000);
afterAll(() => runtime.dispose());
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
  it('separates quote numbers from invoice numbers', async () => {
    const draft = specimen();
    const quote = await run(
      store.save({ ...draft, data: asQuote(draft.data) }, owner),
    );
    expect(
      (
        await run(
          store.issue(
            { id: quote.id, revision: 1, key: crypto.randomUUID() },
            owner,
          ),
        )
      ).number,
    ).toMatch(/^P-\d{4}-/);
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

describe('payment plans', () => {
  const id = () => RecordId.make(crypto.randomUUID());
  const plan = (name: string) => ({
    ...inFull,
    id: id(),
    name,
    parts: inFull.parts.map((part) => ({ ...part, id: id() })),
  });
  const issue = async () => {
    const draft = await run(store.save(specimen(), owner));
    return run(
      store.issue(
        { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
        owner,
      ),
    );
  };

  it('issues an invoice with a copy of the defaults its total qualifies for', async () => {
    const small = plan('Any total');
    const large = plan('Large totals');
    await run(
      store.setLibrary([
        { plan: small, default: true, from: null },
        { plan: large, default: true, from: '10000' },
        { plan: plan('Kept, not default'), default: false, from: null },
      ]),
    );
    const invoice = await issue();
    const { plans, chosen } = await run(store.offer(invoice.id));
    expect(plans.map((item) => item.name)).toEqual(['Any total']);
    expect(plans[0]?.id).not.toBe(small.id);
    expect(chosen).toBeNull();
    // The library changing later leaves the invoice's copy alone.
    await run(store.setLibrary([]));
    expect((await run(store.offer(invoice.id))).plans).toEqual(plans);
  });

  it('keeps the customer’s choice while the plan is still offered', async () => {
    const invoice = await issue();
    const first = plan('First');
    const second = plan('Second');
    await run(store.setOffer(invoice.id, [first, second], owner));
    await run(store.choose(invoice.id, second.id, 'customer'));
    expect((await run(store.offer(invoice.id))).chosen).toBe(second.id);
    const unknown = await run(
      Effect.result(store.choose(invoice.id, id(), 'customer')),
    );
    expect(unknown._tag).toBe('Failure');
    await run(store.setOffer(invoice.id, [first], owner));
    expect((await run(store.offer(invoice.id))).chosen).toBeNull();
    await run(store.setOffer(invoice.id, null, owner));
    expect(await run(store.offer(invoice.id))).toEqual(noOffer);
  });
});

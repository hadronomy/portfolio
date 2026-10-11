import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CustomerAccess,
  type CustomerAccessApi,
  customerEmail,
} from './customer-access';
import { InvoiceDatabase } from './database';
import { specimen } from './fixtures';
import { type Invoice, OwnerDid, RecordId } from './model';
import { InvoiceStore, type StoreApi } from './store';
import * as tables from './tables';
import { testRuntime } from './testing';

const runtime = testRuntime();
let store: StoreApi;
let access: CustomerAccessApi;
const owner = OwnerDid.make('owner');
const run = Effect.runPromise;

beforeAll(async () => {
  store = await runtime.runPromise(Effect.service(InvoiceStore));
  access = await runtime.runPromise(Effect.service(CustomerAccess));
}, 20000);
afterAll(() => runtime.dispose());

async function issued(email: string, edit = (invoice: Invoice) => invoice) {
  const base = specimen();
  const draft = await run(
    store.save(
      edit({
        ...base,
        data: { ...base.data, customer: { ...base.data.customer, email } },
      }),
      owner,
    ),
  );
  return run(
    store.issue(
      { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
      owner,
    ),
  );
}

async function link(
  invoice: Invoice,
  change: { expired?: boolean; revoked?: boolean } = {},
) {
  const now = Date.now();
  const db = await runtime.runPromise(Effect.service(InvoiceDatabase));
  await run(
    db.insert(tables.links).values({
      tokenHash: crypto.randomUUID(),
      invoiceId: invoice.id,
      expiresAt: new Date(
        now + (change.expired ? -1 : 1) * 86_400_000,
      ).toISOString(),
      revokedAt: change.revoked ? new Date(now).toISOString() : null,
      createdAt: new Date(now).toISOString(),
    }),
  );
}

describe('customer access', () => {
  it('admits an address only while one of its invoices has a link open', async () => {
    const email = customerEmail('Billing@Acme.test ');
    expect(email).toBe('billing@acme.test');
    const invoice = await issued('billing@acme.test');
    expect(await run(access.admits(email))).toBe(false);
    await link(invoice, { expired: true });
    await link(invoice, { revoked: true });
    expect(await run(access.admits(email))).toBe(false);
    await link(invoice);
    expect(await run(access.admits(email))).toBe(true);
    expect(await run(access.admits(customerEmail('other@acme.test')))).toBe(
      false,
    );
  });

  it('lists issued invoices billed to the address, with what is still owed', async () => {
    const email = customerEmail('list@acme.test');
    const first = await issued(' LIST@acme.test');
    const second = await issued('list@acme.test');
    await issued('someone-else@acme.test');
    await run(
      store.save(
        {
          ...specimen(),
          data: {
            ...specimen().data,
            customer: { ...specimen().data.customer, email },
          },
        },
        owner,
      ),
    );
    await run(
      store.payment(
        {
          id: RecordId.make(crypto.randomUUID()),
          invoiceId: first.id,
          amount: '100.00',
          date: '2026-10-01',
          method: 'transfer',
          reference: '',
          createdAt: new Date().toISOString(),
          reversedAt: null,
        },
        owner,
      ),
    );
    const listed = await run(access.invoices(email));
    expect(listed.map((invoice) => invoice.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    const paidInPart = listed.find((invoice) => invoice.id === first.id);
    expect(Number(paidInPart?.total) - Number(paidInPart?.remaining)).toBe(100);
  });

  it('reads one invoice only for the address it is billed to', async () => {
    const invoice = await issued('one@acme.test');
    expect(
      (await run(access.invoice(customerEmail('one@acme.test'), invoice.id)))
        .id,
    ).toBe(invoice.id);
    const other = await run(
      Effect.result(access.invoice(customerEmail('two@acme.test'), invoice.id)),
    );
    expect(other._tag).toBe('Failure');
  });
});

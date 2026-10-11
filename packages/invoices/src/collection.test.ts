import { eq } from 'drizzle-orm';
import { Effect, Layer } from 'effect';
import type Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Collection, collectionLayer, paymentRecordId } from './collection';
import { AttemptId } from './collection-model';
import { InvoiceDatabase } from './database';
import { specimen } from './fixtures';
import { type Invoice, OwnerDid, RecordId } from './model';
import { inFull, type Offer, type PaymentPlan } from './plan';
import { settlementOf } from './settlement';
import { InvoiceStore, type StoreApi } from './store';
import { StripeGateway, type StripeGatewayApi } from './stripe/gateway';
import {
  type InvoicePaymentId,
  type Minor,
  type PaymentIntentId,
  type StripeCustomerId,
  type StripeEvent,
  StripeFailure,
  type StripeInvoice,
  type StripeInvoiceId,
  type StripeInvoicePayment,
} from './stripe/schema';
import * as tables from './tables';
import { testRuntime } from './testing';

// Stripe IDs are unique across the account, and the database outlives each
// test's fake, so the counter does too.
let next = 0;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Payment = Mutable<StripeInvoicePayment>;

type Intent = {
  id: PaymentIntentId;
  amount: number;
  status: string;
  invoice: StripeInvoiceId | null;
};

/**
 * Stripe, as far as collection can tell: invoices that add their lines up,
 * idempotency keys that replay the first answer, PaymentIntents the customer
 * confirms, and payments that can be refunded.
 */
function fakeStripe() {
  const invoices = new Map<string, StripeInvoice>();
  const payments = new Map<string, Payment[]>();
  const intents = new Map<string, Intent>();
  const replies = new Map<string, unknown>();
  const calls: string[] = [];
  // A replayed key returns the first answer, as Stripe does for 24 hours.
  const once = <A>(key: string, run: () => A): A => {
    if (!replies.has(key)) replies.set(key, run());
    return replies.get(key) as A;
  };
  const invoice = (id: string) => {
    const found = invoices.get(id);
    if (!found) throw new Error(`No such invoice ${id}`);
    return found;
  };
  const update = (id: string, change: Partial<StripeInvoice>) => {
    const updated = { ...invoice(id), ...change };
    invoices.set(id, updated);
    return updated;
  };
  const totals = (lines: readonly Stripe.InvoiceAddLinesParams.Line[]) => {
    const taxes = lines.flatMap((line) =>
      Array.isArray(line.tax_amounts) ? line.tax_amounts : [],
    );
    const subtotal = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
    const total = subtotal + taxes.reduce((sum, tax) => sum + tax.amount, 0);
    return {
      subtotal: subtotal as Minor,
      total: total as Minor,
      amountRemaining: total as Minor,
      taxes: taxes.map((tax) => ({
        amount: tax.amount as Minor,
        taxableAmount: tax.taxable_amount as Minor,
      })),
      lines: { data: lines.map(() => ({})) },
    };
  };
  /** Settles `amount` on the invoice, as a successful payment does. */
  const apply = (id: string, payment: Payment, amount: number) => {
    Object.assign(payment, {
      status: 'paid',
      amountPaid: amount,
      paidAt: Date.UTC(2026, 9, 2) / 1000,
    });
    const remaining = invoice(id).amountRemaining - amount;
    update(id, {
      amountRemaining: remaining as Minor,
      status: remaining <= 0 ? 'paid' : 'open',
    });
  };
  /** Lets a test bend the totals Stripe reports. */
  let skew = 0;

  const api: StripeGatewayApi = {
    customer: ({ id, key }) => {
      calls.push('customer');
      return Effect.succeed(
        id ?? once(key, () => `cus_${++next}` as StripeCustomerId),
      );
    },
    draft: (params, key) => {
      calls.push('draft');
      return Effect.sync(() =>
        once(key, () => {
          const created: StripeInvoice = {
            id: `in_${++next}` as StripeInvoiceId,
            status: 'draft',
            currency: params.currency ?? 'eur',
            subtotal: 0 as Minor,
            total: 0 as Minor,
            amountRemaining: 0 as Minor,
            taxes: [],
            lines: { data: [] },
            metadata: Object(params.metadata),
          };
          invoices.set(created.id, created);
          return created;
        }),
      );
    },
    addLines: (id, lines, key) => {
      calls.push('addLines');
      return Effect.sync(() =>
        once(key, () => {
          const added = totals(lines);
          return update(id, { ...added, total: (added.total + skew) as Minor });
        }),
      );
    },
    finalize: (id, key) => {
      calls.push('finalize');
      return Effect.sync(() => once(key, () => update(id, { status: 'open' })));
    },
    read: (id) => {
      calls.push('read');
      const found = invoices.get(id);
      return found
        ? Effect.succeed(found)
        : Effect.fail(
            new StripeFailure({
              operation: 'read',
              reason: 'request',
              message: 'No such invoice',
              status: 404,
              requestId: null,
              retryable: false,
            }),
          );
    },
    find: () => {
      calls.push('find');
      return Effect.succeed(null);
    },
    payments: (id) => {
      calls.push('payments');
      // The intent's status is live, as an expanded PaymentIntent would be.
      return Effect.sync(() =>
        (payments.get(id) ?? []).map((payment) => ({
          ...payment,
          intent: payment.intent && {
            id: payment.intent.id,
            status: intents.get(payment.intent.id)?.status ?? 'unknown',
          },
        })),
      );
    },
    intent: (params, key) => {
      calls.push('intent');
      return Effect.sync(() => {
        const intent = once(key, () => {
          const created: Intent = {
            id: `pi_${++next}` as PaymentIntentId,
            amount: params.amount,
            status: 'requires_payment_method',
            invoice: null,
          };
          intents.set(created.id, created);
          return created;
        });
        return {
          id: intent.id,
          clientSecret: `${intent.id}_secret`,
          status: intent.status,
        };
      });
    },
    attach: (id, intentId, key) => {
      calls.push('attach');
      return Effect.sync(() =>
        once(key, () => {
          const intent = intents.get(intentId);
          if (!intent) throw new Error(`No such intent ${intentId}`);
          intent.invoice = id;
          payments.set(id, [
            ...(payments.get(id) ?? []),
            {
              id: `inpay_${++next}` as InvoicePaymentId,
              status: 'open',
              isDefault: false,
              amountRequested: intent.amount as Minor,
              amountPaid: null,
              paidAt: null,
              refunded: 0 as Minor,
              intent: { id: intent.id, status: intent.status },
            },
          ]);
          return invoice(id);
        }),
      );
    },
    cancel: (intentId) => {
      calls.push('cancel');
      return Effect.sync(() => {
        const intent = intents.get(intentId);
        if (!intent) return;
        intent.status = 'canceled';
        for (const list of payments.values())
          for (const payment of list)
            if (payment.intent?.id === intentId) payment.status = 'canceled';
      });
    },
    invoiceOf: (intentId) => {
      calls.push('invoiceOf');
      return Effect.succeed(intents.get(intentId)?.invoice ?? null);
    },
  };

  return {
    api,
    calls,
    invoices,
    intents,
    payments,
    skew: (cents: number) => {
      skew = cents;
    },
    /** The only Stripe invoice the test made. */
    only() {
      const [id] = [...invoices.keys()];
      if (!id) throw new Error('No Stripe invoice yet');
      return id;
    },
    /** The customer pays everything through the invoice's own payment. */
    pay(id: string) {
      const payment: Payment = {
        id: `inpay_${++next}` as InvoicePaymentId,
        status: 'open',
        isDefault: true,
        amountRequested: invoice(id).amountRemaining,
        amountPaid: null,
        paidAt: null,
        refunded: 0 as Minor,
        intent: null,
      };
      payments.set(id, [...(payments.get(id) ?? []), payment]);
      apply(id, payment, payment.amountRequested);
      return payment;
    },
    /** The browser confirms a PaymentIntent, and the bank answers `outcome`. */
    confirm(clientSecret: string, outcome: 'succeeded' | 'processing') {
      const intent = intents.get(clientSecret.replace(/_secret$/, ''));
      if (!intent?.invoice) throw new Error('Unattached intent');
      intent.status = outcome;
      const payment = payments
        .get(intent.invoice)
        ?.find((found) => found.intent?.id === intent.id);
      if (payment && outcome === 'succeeded')
        apply(intent.invoice, payment, intent.amount);
      return intent;
    },
    refund(payment: Payment, amount: number) {
      payment.refunded = (payment.refunded + amount) as Minor;
    },
  };
}

const runtime = testRuntime();
let store: StoreApi;
let database: InvoiceDatabase['Service'];
let stripe: ReturnType<typeof fakeStripe>;
const owner = OwnerDid.make('owner');
const newId = () => RecordId.make(crypto.randomUUID());
// Any amount, down to what Stripe can charge.
const parts: PaymentPlan = {
  ...inFull,
  id: newId(),
  name: 'Any amount',
  floor: { _tag: 'Amount', value: '0' },
};
const depositThenRest = (ahead: boolean): PaymentPlan => ({
  id: newId(),
  name: 'Deposit first',
  parts: [
    {
      _tag: 'Once',
      id: newId(),
      label: 'Deposit',
      portion: { _tag: 'Percent', value: '30' },
      due: { _tag: 'OnIssue' },
    },
    {
      _tag: 'Once',
      id: newId(),
      label: 'Balance',
      portion: { _tag: 'Rest' },
      due: { _tag: 'InvoiceDue' },
    },
  ],
  ahead,
  floor: null,
});

beforeAll(async () => {
  store = await runtime.runPromise(Effect.service(InvoiceStore));
  database = await runtime.runPromise(Effect.service(InvoiceDatabase));
}, 20000);
afterAll(() => runtime.dispose());
beforeEach(() => {
  stripe = fakeStripe();
});

const run = <A, E>(effect: Effect.Effect<A, E, Collection>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        collectionLayer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(InvoiceStore, store),
              Layer.succeed(InvoiceDatabase, database),
              Layer.succeed(StripeGateway, stripe.api),
            ),
          ),
        ),
      ),
    ),
  );

const fail = <A, E>(effect: Effect.Effect<A, E, Collection>) =>
  run(Effect.flip(effect));

async function issued(change: Partial<Invoice['data']> = {}) {
  const draft = specimen();
  const saved = await Effect.runPromise(
    store.save({ ...draft, data: { ...draft.data, ...change } }, owner),
  );
  return Effect.runPromise(
    store.issue(
      { id: saved.id, revision: saved.revision, key: crypto.randomUUID() },
      owner,
    ),
  );
}

const share = (invoice: Invoice, plans?: Offer) =>
  Effect.gen(function* () {
    if (plans) yield* store.setOffer(invoice.id, plans, owner);
    return yield* Collection.use((collection) =>
      collection.share(invoice.id, owner),
    );
  });
// The link's page and payments, as the app runs them: the token names the
// invoice, then everything else is about the invoice.
const checkout = (token: string) =>
  Collection.use((collection) =>
    Effect.flatMap(collection.resolve(token), collection.checkout),
  );
const pay = (
  token: string,
  amount: string,
  plan: PaymentPlan = inFull,
  attempt = crypto.randomUUID(),
) =>
  Collection.use((collection) =>
    Effect.flatMap(collection.resolve(token), (id) =>
      collection.pay(id, {
        amount,
        attempt: AttemptId.make(attempt),
        plan: plan.id,
      }),
    ),
  );
const status = (invoice: Invoice) =>
  Collection.use((collection) => collection.status(invoice.id));
const ledger = (invoice: Invoice) =>
  Effect.runPromise(store.payments(invoice.id));
const event = (type: string, object: Record<string, unknown>) =>
  JSON.stringify({ id: `evt_${++next}`, type, data: { object } });
// A delivery as the payments Worker handles it, minus the signature check:
// the event names a settlement, and the settlement runs.
const receive = (payload: string) =>
  Effect.gen(function* () {
    const collection = yield* Collection;
    const settlement = settlementOf(JSON.parse(payload) as StripeEvent);
    if (settlement) yield* collection.settle(settlement);
  });

// The specimen invoice: €2,225.00 of services plus 7% IGIC.
const total = '2380.75';

describe('sharing an invoice', () => {
  it('puts it up for payment once, however often it is shared', async () => {
    const invoice = await issued();
    const first = await run(share(invoice));
    const second = await run(share(invoice));
    expect(first.status).toEqual({ _tag: 'Open', links: 1 });
    expect(second.status).toEqual({ _tag: 'Open', links: 2 });
    expect(second.token).not.toBe(first.token);
    expect(stripe.calls.filter((call) => call === 'draft')).toHaveLength(1);
    expect(stripe.calls.filter((call) => call === 'finalize')).toHaveLength(1);
  });

  it('never finalizes a Stripe invoice that adds up differently', async () => {
    const invoice = await issued();
    stripe.skew(1);
    expect((await fail(share(invoice)))._tag).toBe('ProjectionMismatch');
    expect(stripe.calls).not.toContain('finalize');
    expect(await run(status(invoice))).toEqual({
      _tag: 'Review',
      review: {
        _tag: 'Mismatch',
        differences: [{ field: 'total', expected: 238075, actual: 238076 }],
      },
    });
  });

  it('refuses what cannot be collected', async () => {
    const draft = await Effect.runPromise(store.save(specimen(), owner));
    expect(await fail(share(draft))).toMatchObject({
      _tag: 'NotCollectible',
      reason: 'draft',
    });
    const proforma = await issued({ kind: 'proforma' });
    expect(await fail(share(proforma))).toMatchObject({ reason: 'proforma' });
  });
});

describe('payment links', () => {
  it('shows the invoice and asks for exactly what is owed', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    const page = await run(checkout(token));
    expect(page).toMatchObject({
      _tag: 'Payable',
      invoice: { number: invoice.number, total, remaining: total },
      plans: [
        {
          options: { choices: [{ kind: 'next', amount: total }], range: null },
        },
      ],
      locked: false,
    });
    expect(page.invoice.lines).toHaveLength(3);
    expect(page.invoice.lines[1]).toMatchObject({
      quantity: '2',
      unitPrice: '425',
      amount: '850.00',
    });
  });

  it('opens only while valid, and closes when revoked', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    expect((await fail(checkout('not-a-token')))._tag).toBe('LinkInvalid');
    expect((await fail(checkout(`${token.slice(0, -1)}A`)))._tag).toBe(
      'LinkInvalid',
    );
    const revoked = await run(
      Collection.use((collection) => collection.revoke(invoice.id, owner)),
    );
    expect(revoked).toBe(1);
    expect((await fail(checkout(token)))._tag).toBe('LinkInvalid');
    expect(await run(status(invoice))).toEqual({ _tag: 'Open', links: 0 });

    const fresh = await run(share(invoice));
    await Effect.runPromise(
      database
        .update(tables.links)
        .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        .where(eq(tables.links.invoiceId, invoice.id)),
    );
    expect((await fail(checkout(fresh.token)))._tag).toBe('LinkInvalid');
  });

  it('pauses payment when the ledger moved after the link was shared', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    await Effect.runPromise(
      store.payment(
        {
          id: RecordId.make(crypto.randomUUID()),
          invoiceId: invoice.id,
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
    expect((await run(checkout(token)))._tag).toBe('Unavailable');
    expect(await fail(pay(token, '2280.75'))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
  });
});

describe('paying', () => {
  it('takes the whole amount through a PaymentIntent attached to the invoice', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    const { clientSecret } = await run(pay(token, total));
    stripe.confirm(clientSecret, 'succeeded');
    await run(
      receive(event('invoice.paid', { object: 'invoice', id: stripe.only() })),
    );
    expect((await run(checkout(token)))._tag).toBe('Paid');
    expect(await ledger(invoice)).toEqual([
      expect.objectContaining({ amount: total, method: 'stripe' }),
    ]);
    expect(await run(status(invoice))).toEqual({ _tag: 'Paid' });
  });

  it('takes the whole amount only, unless the plan allows parts', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    expect(await fail(pay(token, '300.00'))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
  });

  it('takes parts when the plan allows them, down to what Stripe can charge', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice, [parts]));
    expect(await run(checkout(token))).toMatchObject({
      plans: [{ options: { range: { minimum: '0.50', maximum: '2380.25' } } }],
    });
    // Too small, more than owed, and a part that would strand €0.25.
    for (const amount of ['0.49', '2380.76', '2380.50'])
      expect(await fail(pay(token, amount, parts))).toMatchObject({
        failure: { _tag: 'Changed' },
      });

    const first = await run(pay(token, '300.00', parts));
    stripe.confirm(first.clientSecret, 'succeeded');
    const page = await run(checkout(token));
    expect(page).toMatchObject({
      _tag: 'Payable',
      invoice: {
        remaining: '2080.75',
        payments: [{ date: '2026-10-02', amount: '300.00' }],
      },
    });

    const rest = await run(pay(token, '2080.75', parts));
    stripe.confirm(rest.clientSecret, 'succeeded');
    expect((await run(checkout(token)))._tag).toBe('Paid');
    expect((await ledger(invoice)).map((payment) => payment.amount)).toEqual([
      '300.00',
      '2080.75',
    ]);
  });

  it('takes instalments in order, as the plan lays them out', async () => {
    // A due date that stays ahead of the clock, so only the deposit is due.
    const invoice = await issued({ dueDate: '2099-12-31' });
    const plan = depositThenRest(false);
    const { token } = await run(share(invoice, [plan]));
    const page = await run(checkout(token));
    expect(page).toMatchObject({
      _tag: 'Payable',
      plans: [
        {
          schedule: {
            instalments: [
              { label: 'Deposit', amount: '714.23' },
              { label: 'Balance', amount: '1666.52' },
            ],
          },
          options: { choices: [{ kind: 'next', amount: '714.23' }] },
        },
      ],
    });
    expect(await fail(pay(token, total, plan))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
    const deposit = await run(pay(token, '714.23', plan));
    stripe.confirm(deposit.clientSecret, 'succeeded');
    expect(await run(checkout(token))).toMatchObject({
      plans: [
        {
          schedule: { instalments: [{ state: 'paid' }, { paid: '0.00' }] },
          options: { choices: [{ kind: 'next', amount: '1666.52' }] },
        },
      ],
    });
  });

  it('lets the customer choose a plan, and keeps them to it once they pay', async () => {
    const invoice = await issued();
    const deposit = depositThenRest(true);
    const { token } = await run(share(invoice, [parts, deposit]));
    const page = await run(checkout(token));
    expect(page).toMatchObject({
      plans: [{ id: parts.id }, { id: deposit.id }],
      selected: parts.id,
      locked: false,
    });
    // An amount only the other plan allows is refused under this one.
    expect(await fail(pay(token, '300.00', deposit))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
    const first = await run(pay(token, '714.23', deposit));
    stripe.confirm(first.clientSecret, 'succeeded');
    expect(await run(checkout(token))).toMatchObject({
      plans: [{ id: deposit.id }],
      selected: deposit.id,
      locked: true,
    });
    expect(await fail(pay(token, '300.00', parts))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
  });

  it('opens an invoice nobody shared, for a customer who may see it', async () => {
    const invoice = await issued();
    const page = await run(
      Collection.use((collection) => collection.checkout(invoice.id)),
    );
    expect(page._tag).toBe('Payable');
    expect(stripe.calls).toContain('finalize');
    expect(await run(status(invoice))).toEqual({ _tag: 'Open', links: 0 });
  });

  it('shows an invoice settled some other way as paid, without Stripe', async () => {
    const invoice = await issued();
    await Effect.runPromise(
      store.payment(
        {
          id: RecordId.make(crypto.randomUUID()),
          invoiceId: invoice.id,
          amount: total,
          date: '2026-10-01',
          method: 'transfer',
          reference: '',
          createdAt: new Date().toISOString(),
          reversedAt: null,
        },
        owner,
      ),
    );
    const page = await run(
      Collection.use((collection) => collection.checkout(invoice.id)),
    );
    expect(page._tag).toBe('Paid');
    expect(stripe.calls).toEqual([]);
  });

  it('cancels an abandoned attempt before starting another', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice, [parts]));
    const attempt = crypto.randomUUID();
    const abandoned = await run(pay(token, '100.00', parts, attempt));
    // The same attempt again is the same PaymentIntent, not a second one.
    expect(await run(pay(token, '100.00', parts, attempt))).toEqual(abandoned);
    await run(pay(token, '200.00', parts));
    const statuses = [...stripe.intents.values()].map(
      (intent) => intent.status,
    );
    expect(statuses).toEqual(['canceled', 'requires_payment_method']);
  });

  it('waits while a payment is still on its way', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice, [parts]));
    const { clientSecret } = await run(pay(token, '500.00', parts));
    stripe.confirm(clientSecret, 'processing');
    expect(await run(checkout(token))).toMatchObject({
      _tag: 'Processing',
      amount: '500.00',
    });
    expect(await fail(pay(token, '100.00', parts))).toMatchObject({
      failure: { _tag: 'Changed' },
    });
  });
});

describe('settling', () => {
  it('reconciles every collection that can still change, and not the others', async () => {
    const open = await issued();
    await run(share(open));
    const before = await run(
      Collection.use((collection) => collection.unsettled()),
    );
    const settlement = before.find(
      (item) => item._tag === 'Invoice' && item.invoice === stripe.only(),
    );
    expect(settlement).toBeDefined();
    // Settling the same invoice again records nothing new.
    if (settlement)
      expect(
        await run(
          Collection.use((collection) => collection.settle(settlement)),
        ),
      ).toEqual({ _tag: 'Open', links: 1 });
    await Effect.runPromise(
      database
        .update(tables.collections)
        .set({
          state: 'paid',
          updatedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
        })
        .where(eq(tables.collections.invoiceId, open.id)),
    );
    const after = await run(
      Collection.use((collection) => collection.unsettled()),
    );
    expect(after).not.toContainEqual(settlement);
  });

  it('finds the invoice a PaymentIntent paid toward', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    const { clientSecret } = await run(pay(token, total));
    const intent = stripe.confirm(clientSecret, 'succeeded');
    expect(
      await run(
        Collection.use((collection) =>
          collection.settle({ _tag: 'Intent', intent: intent.id }),
        ),
      ),
    ).toEqual({ _tag: 'Paid' });
  });

  it('records each payment once, from any number of events', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    const payment = stripe.pay(stripe.only());
    const paid = event('invoice.paid', {
      object: 'invoice',
      id: stripe.only(),
    });
    await run(receive(paid));
    await run(receive(paid));
    expect((await run(checkout(token)))._tag).toBe('Paid');
    expect(await ledger(invoice)).toEqual([
      expect.objectContaining({
        id: paymentRecordId(payment.id),
        amount: total,
        reference: payment.id,
      }),
    ]);
  });

  it('catches up with a payment the webhook has not delivered yet', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    stripe.pay(stripe.only());
    expect((await run(checkout(token)))._tag).toBe('Paid');
    expect(await ledger(invoice)).toHaveLength(1);
  });

  it('turns a refund into a reversal, and keeps what was not refunded', async () => {
    const invoice = await issued();
    const { token } = await run(share(invoice));
    const { clientSecret } = await run(pay(token, total));
    const intent = stripe.confirm(clientSecret, 'succeeded');
    const payment = stripe.payments.get(stripe.only())?.[0];
    if (!payment) throw new Error('No payment');
    await run(
      receive(event('invoice.paid', { object: 'invoice', id: stripe.only() })),
    );

    // A partial refund, announced on the charge: the event only names the
    // PaymentIntent, so its invoice is looked up.
    stripe.refund(payment, 38075);
    const refunded = event('charge.refunded', {
      object: 'charge',
      id: 'ch_1',
      payment_intent: intent.id,
    });
    await run(receive(refunded));
    await run(receive(refunded));
    expect(
      (await ledger(invoice)).map(({ amount, reversedAt }) => [
        amount,
        !!reversedAt,
      ]),
    ).toEqual([
      [total, true],
      ['2000.00', false],
    ]);
    expect(await run(status(invoice))).toEqual({
      _tag: 'Review',
      review: { _tag: 'Refunded', amount: '380.75' },
    });
    expect((await run(checkout(token)))._tag).toBe('Unavailable');

    // The rest goes back too: nothing of the payment is left standing.
    stripe.refund(payment, 200000);
    await run(receive(refunded));
    expect(
      (await ledger(invoice)).every((record) => record.reversedAt !== null),
    ).toBe(true);
  });
});

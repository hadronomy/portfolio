import { Effect, Schema } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { quoteSpecimen } from './fixtures';
import { type Invoice, OwnerDid, RecordId } from './model';
import type { PaymentPlan } from './plan';
import { type Answer, Signature } from './quote-model';
import { Quotes, type QuotesApi } from './quotes';
import { InvoiceStore, type StoreApi } from './store';
import { testRuntime } from './testing';

const runtime = testRuntime();
let store: StoreApi;
let quotes: QuotesApi;
const owner = OwnerDid.make('owner');
const evidence = { address: '203.0.113.7', agent: 'Test browser' };
/** A drawn signature, as the pad exports one. */
const ink =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 12 240 96" width="240" height="96"><path d="M10.5 20 Q12 22 14.25 21 16 18 10.5 20 Z" fill="#1d3fae"/></svg>';
beforeAll(async () => {
  store = await runtime.runPromise(Effect.service(InvoiceStore));
  quotes = await runtime.runPromise(Effect.service(Quotes));
}, 20000);
afterAll(() => runtime.dispose());
const run = Effect.runPromise;
const fail = <A, E>(effect: Effect.Effect<A, E>) => run(Effect.flip(effect));

/** An issued quote that stays valid for as long as the suite runs. */
async function issuedQuote(
  change: Partial<Invoice['data']> = {},
): Promise<Invoice> {
  const specimen = quoteSpecimen();
  const data = {
    ...specimen.data,
    ...change,
    quote: specimen.data.quote && {
      ...specimen.data.quote,
      validUntil: '2099-12-31',
    },
  };
  const draft = await run(store.save({ ...specimen, data }, owner));
  return run(
    store.issue(
      { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
      owner,
    ),
  );
}

async function answer(quote: Invoice, change: Partial<Answer> = {}) {
  const { digests } = await run(quotes.view(quote.id));
  return run(
    quotes.respond(
      quote.id,
      {
        outcome: 'accepted',
        name: 'Lucy Martin',
        earlyStart: true,
        language: 'en',
        digest: digests.en,
        plan: null,
        signature: ink,
        ...change,
      },
      evidence,
    ),
  );
}

describe('quotes', () => {
  it('number quotes in their own series', async () => {
    const quote = await issuedQuote();
    expect(quote.number).toMatch(/^P-\d{4}-\d{4}$/);
    expect((await run(quotes.view(quote.id))).state).toBe('open');
  });

  it('share only an open quote', async () => {
    const draft = await run(store.save(quoteSpecimen(), owner));
    expect(await fail(quotes.share(draft.id, owner))).toMatchObject({
      reason: 'draft',
    });
    const quote = await issuedQuote();
    const { token } = await run(quotes.share(quote.id, owner));
    expect(await run(quotes.resolve(token))).toBe(quote.id);
    expect(await run(quotes.links(quote.id))).toBe(1);
    expect(await run(quotes.revoke(quote.id, owner))).toBe(1);
    expect((await fail(quotes.resolve(token)))._tag).toBe('LinkInvalid');
  });

  it('record an acceptance once, against the PDF the customer read', async () => {
    const quote = await issuedQuote();
    expect(
      await fail(
        quotes.respond(
          quote.id,
          {
            outcome: 'accepted',
            name: 'Lucy',
            earlyStart: false,
            language: 'en',
            digest: '0'.repeat(64),
            plan: null,
            signature: ink,
          },
          evidence,
        ),
      ),
    ).toMatchObject({ reason: 'stale-document' });
    const first = await answer(quote);
    expect(first).toMatchObject({
      outcome: 'accepted',
      name: 'Lucy Martin',
      email: quote.data.customer.email,
      earlyStart: true,
      address: evidence.address,
    });
    expect(await answer(quote)).toEqual(first);
    expect(
      await fail(
        quotes.respond(
          quote.id,
          { ...first, outcome: 'declined', plan: null },
          evidence,
        ),
      ),
    ).toMatchObject({
      reason: 'answered',
    });
    expect((await run(quotes.view(quote.id))).state).toBe('accepted');
    expect(await fail(quotes.share(quote.id, owner))).toMatchObject({
      reason: 'answered',
    });
  });

  it('refuse an acceptance without a drawn signature', async () => {
    const quote = await issuedQuote();
    expect(
      await fail(
        quotes.respond(
          quote.id,
          {
            outcome: 'accepted',
            name: 'Lucy Martin',
            earlyStart: false,
            language: 'en',
            digest: (await run(quotes.view(quote.id))).digests.en,
            plan: null,
            signature: null,
          },
          evidence,
        ),
      ),
    ).toMatchObject({ reason: 'unsigned' });
    expect((await answer(quote)).signature).toBe(ink);
  });

  it('keep the early-start request to consumers', async () => {
    const quote = await issuedQuote({ customerType: 'business' });
    expect((await answer(quote)).earlyStart).toBe(false);
  });

  it('bill each payment of the accepted plan with an invoice of its own', async () => {
    const declined = await issuedQuote();
    await answer(declined, { outcome: 'declined', earlyStart: false });
    expect(await fail(quotes.bill(declined.id, 0, owner))).toMatchObject({
      reason: 'not-accepted',
    });
    const id = () => RecordId.make(crypto.randomUUID());
    const half: PaymentPlan = {
      id: id(),
      name: 'Half now',
      ahead: true,
      floor: null,
      parts: [
        {
          _tag: 'Once',
          id: id(),
          label: '',
          portion: { _tag: 'Percent', value: '50' },
          due: { _tag: 'OnIssue' },
        },
        {
          _tag: 'Once',
          id: id(),
          label: '',
          portion: { _tag: 'Rest' },
          due: { _tag: 'InvoiceDue' },
        },
      ],
    };
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
    await run(store.setOffer(draft.id, [half], owner));
    const quote = await run(
      store.issue(
        { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
        owner,
      ),
    );
    expect(
      (await run(Effect.flip(store.setOffer(quote.id, [half], owner))))._tag,
    ).toBe('InvalidInvoice');
    expect(
      await fail(
        quotes.respond(
          quote.id,
          {
            outcome: 'accepted',
            name: 'Lucy Martin',
            earlyStart: false,
            language: 'en',
            digest: (await run(quotes.view(quote.id))).digests.en,
            plan: id(),
            signature: ink,
          },
          evidence,
        ),
      ),
    ).toMatchObject({ reason: 'no-such-plan' });
    const accepted = await answer(quote);
    expect(accepted.plan?.id).toBe(half.id);
    const first = await run(quotes.bill(quote.id, 0, owner));
    expect(first.data).toMatchObject({
      kind: 'invoice',
      quote: null,
      reference: `Quote ${quote.number}`,
    });
    expect(first.data.title).toContain('Payment 1 of 2');
    expect((await run(quotes.bill(quote.id, 0, owner))).id).toBe(first.id);
    expect((await run(quotes.view(quote.id))).state).toBe('accepted');
    expect(await fail(quotes.bill(quote.id, 2, owner))).toMatchObject({
      reason: 'no-such-payment',
    });
    const second = await run(quotes.bill(quote.id, 1, owner));
    expect((await run(quotes.view(quote.id))).state).toBe('invoiced');
    expect((await run(store.workspace())).responses[quote.id]?.billed).toEqual([
      { payment: 0, invoiceId: first.id },
      { payment: 1, invoiceId: second.id },
    ]);
    // A billed invoice is one payment of an agreed plan: issued, it takes
    // no plans of its own from the library.
    const issued = await run(
      store.issue(
        { id: first.id, revision: first.revision, key: crypto.randomUUID() },
        owner,
      ),
    );
    expect((await run(store.offer(issued.id))).plans).toHaveLength(1);
  });

  it('remember every time a quote went out by email, newest first', async () => {
    const quote = await issuedQuote();
    expect(await run(quotes.emails(quote.id))).toEqual([]);
    const first = {
      to: 'lucy@example.test',
      sentAt: '2026-10-12T09:00:00.000Z',
      expiresAt: '2026-11-11T09:00:00.000Z',
    };
    const again = { ...first, sentAt: '2026-10-13T09:00:00.000Z' };
    await run(quotes.emailed(quote.id, owner, first));
    await run(quotes.emailed(quote.id, owner, again));
    expect(await run(quotes.emails(quote.id))).toEqual([again, first]);
  });

  it('revise an issued quote into a new draft', async () => {
    const quote = await issuedQuote();
    const revision = await run(quotes.revise(quote.id, owner));
    expect(revision.status).toBe('draft');
    expect(revision.id).not.toBe(quote.id);
    expect(revision.data.quote?.pages).toEqual(quote.data.quote?.pages);
  });
});

describe('signature', () => {
  const valid = Schema.is(Signature);
  it('take the SVG the pad exports', () => {
    expect(valid(ink)).toBe(true);
  });
  it('refuse anything the pad does not export', () => {
    for (const tampered of [
      ink.replace('<path', '<script>alert(1)</script><path'),
      ink.replace('fill="#1d3fae"', 'fill="#1d3fae" onload="alert(1)"'),
      ink.replace('fill="#1d3fae"', 'fill="url(https://example.com/x)"'),
      ink.replace('<svg ', '<svg onload="alert(1)" '),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"></svg>',
      `${ink}<img src=x>`,
    ])
      expect(valid(tampered)).toBe(false);
  });
});

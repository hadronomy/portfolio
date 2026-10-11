import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { quoteSpecimen } from './fixtures';
import { type Invoice, OwnerDid } from './model';
import { type Answer, Quotes, type QuotesApi } from './quotes';
import { InvoiceStore, type StoreApi } from './store';
import { testRuntime } from './testing';

const runtime = testRuntime();
let store: StoreApi;
let quotes: QuotesApi;
const owner = OwnerDid.make('owner');
const evidence = { address: '203.0.113.7', agent: 'Test browser' };
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
        ...change,
      },
      evidence,
    ),
  );
}

describe('quotes', () => {
  it('number quotes in their own series', async () => {
    const quote = await issuedQuote();
    expect(quote.number).toMatch(/^P-INV-\d{4}-\d{4}$/);
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
        quotes.respond(quote.id, { ...first, outcome: 'declined' }, evidence),
      ),
    ).toMatchObject({
      reason: 'answered',
    });
    expect((await run(quotes.view(quote.id))).state).toBe('accepted');
    expect(await fail(quotes.share(quote.id, owner))).toMatchObject({
      reason: 'answered',
    });
  });

  it('keep the early-start request to consumers', async () => {
    const quote = await issuedQuote({ customerType: 'business' });
    expect((await answer(quote)).earlyStart).toBe(false);
  });

  it('invoice an accepted quote once', async () => {
    const declined = await issuedQuote();
    await answer(declined, { outcome: 'declined', earlyStart: false });
    expect(await fail(quotes.convert(declined.id, owner))).toMatchObject({
      reason: 'not-accepted',
    });
    const quote = await issuedQuote();
    await answer(quote);
    const invoice = await run(quotes.convert(quote.id, owner));
    expect(invoice.data).toMatchObject({
      kind: 'invoice',
      quote: null,
      reference: `Quote ${quote.number}`,
    });
    expect(invoice.data.lines.map((line) => line.description)).toEqual(
      quote.data.lines.map((line) => line.description),
    );
    expect((await run(quotes.convert(quote.id, owner))).id).toBe(invoice.id);
    expect((await run(quotes.view(quote.id))).state).toBe('invoiced');
    expect((await run(store.workspace())).responses[quote.id]?.invoiceId).toBe(
      invoice.id,
    );
  });

  it('revise an issued quote into a new draft', async () => {
    const quote = await issuedQuote();
    const revision = await run(quotes.revise(quote.id, owner));
    expect(revision.status).toBe('draft');
    expect(revision.id).not.toBe(quote.id);
    expect(revision.data.quote?.pages).toEqual(quote.data.quote?.pages);
  });
});

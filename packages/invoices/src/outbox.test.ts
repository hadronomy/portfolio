import { eq, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InvoiceDatabase } from './database';
import { quoteSpecimen } from './fixtures';
import { OwnerDid } from './model';
import { idempotencyWindow, Outbox } from './outbox';
import { Quotes } from './quotes';
import { InvoiceStore } from './store';
import * as tables from './tables';
import { testRuntime } from './testing';

const runtime = testRuntime();
const owner = OwnerDid.make('owner');
const run = runtime.runPromise.bind(runtime);
let db: InvoiceDatabase['Service'];
let outbox: Outbox['Service'];
let quotes: Quotes['Service'];
let store: InvoiceStore['Service'];
beforeAll(async () => {
  db = await run(InvoiceDatabase);
  outbox = await run(Outbox);
  quotes = await run(Quotes);
  store = await run(InvoiceStore);
}, 20_000);
afterAll(() => runtime.dispose());

async function issued() {
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
  return run(
    store.issue(
      { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
      owner,
    ),
  );
}
async function answer(id: Parameters<Quotes['Service']['respond']>[0]) {
  const initial = await run(store.read(id));
  if ((await run(quotes.details(id))).state === 'waiting')
    await run(
      quotes.confirmDetails(
        id,
        {
          customer: initial.data.customer,
          customerType: initial.data.customerType,
        },
        { address: '', agent: 'test' },
      ),
    );
  const view = await run(quotes.view(id));
  return run(
    quotes.respond(
      id,
      {
        outcome: 'declined',
        name: 'Lucy Martin',
        earlyStart: false,
        language: 'en',
        digest: view.digests.en,
        plan: null,
        signature: null,
      },
      { address: '', agent: 'test' },
      {
        url: 'https://example.test/quote',
        workspaceUrl: `https://example.test/invoices/${id}`,
      },
    ),
  );
}

describe('mail outbox', () => {
  it('queues separate recipients with the answer and does not repeat them', async () => {
    const quote = await issued();
    await answer(quote.id);
    await answer(quote.id);
    const rows = await run(outbox.deliveries(quote.id));
    expect(rows.map((row) => row.kind).sort()).toEqual([
      'quote-answer',
      'quote-answered',
    ]);
    expect(
      rows.every((row) => row.state === 'pending' && row.attempts === 0),
    ).toBe(true);
  });

  it('rolls the answer back when its outbox write fails', async () => {
    const quote = await issued();
    await run(
      db.execute(
        sql`create function invoices.refuse_test_mail() returns trigger language plpgsql as $$ begin raise exception 'test mail failure'; end $$`,
      ),
    );
    await run(
      db.execute(
        sql`create trigger refuse_test_mail before insert on invoices.mail_outbox for each row execute function invoices.refuse_test_mail()`,
      ),
    );
    try {
      await expect(answer(quote.id)).rejects.toThrow();
      expect((await run(quotes.view(quote.id))).response).toBeNull();
      expect(await run(outbox.deliveries(quote.id))).toEqual([]);
    } finally {
      await run(
        db.execute(sql`drop trigger refuse_test_mail on invoices.mail_outbox`),
      );
      await run(db.execute(sql`drop function invoices.refuse_test_mail()`));
    }
  });

  it('queues the invitation and owner copy with their link', async () => {
    const quote = await issued();
    await run(
      quotes.invite(quote.id, owner, {
        base: 'https://example.test',
        to: 'lucy@example.test',
        note: 'Please read',
        copy: true,
      }),
    );
    expect(await run(quotes.links(quote.id))).toBe(1);
    const rows = await run(outbox.deliveries(quote.id));
    expect(rows.map((row) => row.kind).sort()).toEqual([
      'quote-copy',
      'quote-invitation',
    ]);
    expect(rows[0]?.id).not.toBe(rows[1]?.id);
  });

  it('rolls the invitation link back when its mail cannot be queued', async () => {
    const quote = await issued();
    await run(
      db.execute(
        sql`create function invoices.refuse_invitation() returns trigger language plpgsql as $$ begin raise exception 'test mail failure'; end $$`,
      ),
    );
    await run(
      db.execute(
        sql`create trigger refuse_invitation before insert on invoices.mail_outbox for each row execute function invoices.refuse_invitation()`,
      ),
    );
    try {
      await expect(
        run(
          quotes.invite(quote.id, owner, {
            base: 'https://example.test',
            to: 'lucy@example.test',
            note: '',
            copy: true,
          }),
        ),
      ).rejects.toThrow();
      expect(await run(quotes.links(quote.id))).toBe(0);
      expect(await run(outbox.deliveries(quote.id))).toEqual([]);
    } finally {
      await run(
        db.execute(sql`drop trigger refuse_invitation on invoices.mail_outbox`),
      );
      await run(db.execute(sql`drop function invoices.refuse_invitation()`));
    }
  });

  it('stops after eight failures and keeps the attempt count for an owner retry', async () => {
    const quote = await issued();
    await answer(quote.id);
    const [row] = await run(outbox.deliveries(quote.id));
    if (!row) throw new Error('No mail');
    for (let attempt = 1; attempt <= 8; attempt++) {
      await run(
        db
          .update(tables.outbox)
          .set({ nextAttemptAt: new Date(0).toISOString() })
          .where(eq(tables.outbox.id, row.id)),
      );
      const mail = await run(outbox.claim(row.id));
      if (!mail) throw new Error('No claim');
      await run(
        outbox.failed(mail, 'The provider refused the email.', false, false),
      );
      expect(await run(outbox.read(row.id))).toMatchObject({
        state: attempt === 8 ? 'failed' : 'pending',
        attempts: attempt,
      });
    }
    expect(await run(outbox.claim(row.id))).toBeNull();
    expect(await run(outbox.retry(quote.id, row.id, owner))).toMatchObject({
      state: 'pending',
      attempts: 8,
    });
  });

  it('claims one row across concurrent callers and fences an expired lease', async () => {
    const quote = await issued();
    await answer(quote.id);
    const row = (await run(outbox.deliveries(quote.id))).find(
      (mail) => mail.kind === 'quote-answer',
    );
    if (!row) throw new Error('No mail');
    const claims = await Promise.all([
      run(outbox.claim(row.id)),
      run(outbox.claim(row.id)),
    ]);
    const first = claims.find((value) => value !== null);
    expect(claims.filter(Boolean)).toHaveLength(1);
    if (!first) throw new Error('No claim');
    await run(
      db
        .update(tables.outbox)
        .set({ lockedUntil: new Date(0).toISOString() })
        .where(eq(tables.outbox.id, row.id)),
    );
    expect(await run(outbox.sending(first))).toBe(false);
    const second = await run(outbox.claim(row.id));
    if (!second) throw new Error('No reclaimed mail');
    expect(second.claimToken).not.toBe(first.claimToken);
    expect(await run(outbox.sending(first))).toBe(false);
    await run(outbox.sent(first, 'stale-provider-id'));
    expect((await run(outbox.read(row.id)))?.state).toBe('pending');
    await run(outbox.sent(second, 'provider-id'));
    expect((await run(outbox.read(row.id)))?.messageId).toBe('provider-id');
    expect(
      (await run(quotes.view(quote.id))).response?.confirmedAt,
    ).not.toBeNull();
  });

  it('refuses another document and an expired uncertain send', async () => {
    const quote = await issued();
    const other = await issued();
    await answer(quote.id);
    const [row] = await run(outbox.deliveries(quote.id));
    if (!row) throw new Error('No mail');
    expect(
      await run(Effect.flip(outbox.retry(other.id, row.id, owner))),
    ).toMatchObject({ _tag: 'MailRetryRefused' });
    await run(
      db
        .update(tables.outbox)
        .set({
          state: 'failed',
          uncertain: true,
          firstAttemptAt: new Date(
            Date.now() - idempotencyWindow - 1000,
          ).toISOString(),
        })
        .where(eq(tables.outbox.id, row.id)),
    );
    expect(
      await run(Effect.flip(outbox.retry(quote.id, row.id, owner))),
    ).toMatchObject({
      _tag: 'MailRetryRefused',
      message: expect.stringContaining('Check Resend'),
    });
  });
});

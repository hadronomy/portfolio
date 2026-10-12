import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvoiceDatabase } from '@portfolio/invoices/database';
import { quoteSpecimen } from '@portfolio/invoices/fixtures';
import {
  mailRetryPath,
  mailRetrySignature,
  mailRetrySignatureHeader,
  mailRetryTimestampHeader,
} from '@portfolio/invoices/mail-auth';
import { OwnerDid } from '@portfolio/invoices/model';
import { idempotencyWindow, Outbox } from '@portfolio/invoices/outbox';
import { Quotes } from '@portfolio/invoices/quotes';
import { InvoiceStore } from '@portfolio/invoices/store';
import * as tables from '@portfolio/invoices/tables';
import { eq } from 'drizzle-orm';
import {
  ConfigProvider,
  Deferred,
  Effect,
  Fiber,
  Layer,
  ManagedRuntime,
} from 'effect';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { codeLifetime } from '../features/auth/shared';
import { AppConfig } from './config.server';
import { boundedMail, Mailer, mailerLayer } from './mail.server';
import { retryDueMail } from './mail-retry.server';
import { CurrentRequest } from './request.server';
import { appLayer } from './runtime.server';

const secret = 'a'.repeat(32);
const owner = OwnerDid.make('owner');
let directory: string;
let runtime: ManagedRuntime.ManagedRuntime<
  Layer.Success<typeof appLayer>,
  Layer.Error<typeof appLayer>
>;
let db: InvoiceDatabase['Service'];
let outbox: Outbox['Service'];
let quotes: Quotes['Service'];
let store: InvoiceStore['Service'];
let mailer: Mailer['Service'];
const fetchMail = vi.fn<typeof fetch>();
const run = Effect.runPromise;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mail-outbox-'));
  runtime = ManagedRuntime.make(
    appLayer.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            INVOICE_DATA_DIRECTORY: directory,
            NODE_ENV: 'development',
            RESEND_API_KEY: 're_test',
            INVOICE_MAIL_FROM: 'mail@example.test',
            INVOICE_MAIL_RETRY_SECRET: secret,
          }),
        ),
      ),
    ),
  );
  db = await runtime.runPromise(InvoiceDatabase);
  outbox = await runtime.runPromise(Outbox);
  quotes = await runtime.runPromise(Quotes);
  store = await runtime.runPromise(InvoiceStore);
  mailer = await runtime.runPromise(Mailer);
  vi.stubGlobal('fetch', fetchMail);
}, 20_000);
afterAll(async () => {
  vi.unstubAllGlobals();
  await runtime.dispose();
  await rm(directory, { recursive: true, force: true });
});

async function invitation() {
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
  await run(
    quotes.invite(quote.id, owner, {
      base: 'https://example.test',
      to: 'lucy@example.test',
      note: 'Read this quote',
      copy: true,
    }),
  );
  return { quote, deliveries: await run(outbox.deliveries(quote.id)) };
}
const accepted = () =>
  new Response(JSON.stringify({ id: crypto.randomUUID() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('durable email delivery', () => {
  it('keeps unconfigured production mail pending without freezing a development sender', async () => {
    const { quote, deliveries } = await invitation();
    const row = deliveries[0];
    if (!row) throw new Error('No invitation');
    const settings = await runtime.runPromise(AppConfig);
    const unconfigured = await runtime.runPromise(
      Effect.service(Mailer).pipe(
        Effect.provide(Layer.fresh(mailerLayer)),
        Effect.provideService(AppConfig, {
          ...settings,
          production: true,
          mail: undefined,
        }),
      ),
    );
    fetchMail.mockClear();
    expect(await run(unconfigured.send(row.id))).toMatchObject({
      state: 'pending',
      lastError: 'Mail is not configured.',
    });
    expect(fetchMail).not.toHaveBeenCalled();
    expect(
      await run(db.query.outbox.findFirst({ where: { id: row.id } })),
    ).toMatchObject({ prepared: null, firstAttemptAt: null });
    fetchMail.mockImplementation(async () => accepted());
    expect(await run(mailer.retry(quote.id, row.id, owner))).toMatchObject({
      state: 'sent',
      attempts: 2,
    });
    expect(JSON.parse(String(fetchMail.mock.calls[0]?.[1]?.body)).from).toBe(
      'mail@example.test',
    );
  });

  it('keeps failures pending, redacts provider text and retries each recipient separately', async () => {
    const { quote } = await invitation();
    fetchMail
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              name: 'internal_server_error',
              message: 'lucy@example.test is in this provider error',
            }),
            { status: 500 },
          ),
      )
      .mockImplementation(async () => accepted());
    const first = await run(mailer.quote(quote.id));
    expect(first.find((mail) => mail.state === 'pending')).toMatchObject({
      attempts: 1,
      messageId: null,
    });
    expect(first.filter((mail) => mail.state === 'sent')).toHaveLength(1);
    const pending = first.find((mail) => mail.state === 'pending');
    if (!pending) throw new Error('No pending mail');
    expect(pending.lastError).not.toContain('lucy@example.test');
    expect(Date.parse(pending.nextAttemptAt)).toBeGreaterThan(Date.now());
    const retried = await run(mailer.retry(quote.id, pending.id, owner));
    expect(retried).toMatchObject({ state: 'sent', attempts: 2 });
    const count = fetchMail.mock.calls.length;
    await run(mailer.retry(quote.id, pending.id, owner));
    expect(fetchMail.mock.calls.length).toBe(count);
  });

  it('reuses the exact provider request after a lost response, with concurrent retries', async () => {
    const { quote, deliveries } = await invitation();
    const row = deliveries.find((mail) => mail.kind === 'quote-invitation');
    if (!row) throw new Error('No invitation');
    const bodies: unknown[] = [];
    const keys: (string | null)[] = [];
    fetchMail.mockImplementation(async (_, input) => {
      keys.push(new Headers(input?.headers).get('idempotency-key'));
      bodies.push(input?.body);
      if (bodies.length === 1) throw new Error('Response lost');
      return accepted();
    });
    expect((await run(mailer.send(row.id)))?.state).toBe('pending');
    const prepared = await run(
      db.query.outbox.findFirst({ where: { id: row.id } }),
    );
    expect(prepared?.prepared).not.toBeNull();
    await run(
      db
        .update(tables.outbox)
        .set({ nextAttemptAt: new Date(0).toISOString() })
        .where(eq(tables.outbox.id, row.id)),
    );
    await Promise.all([run(mailer.send(row.id)), run(mailer.send(row.id))]);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(keys[1]).toBe(keys[0]);
    expect((await run(outbox.read(row.id)))?.state).toBe('sent');
    const cleared = await run(
      db.query.outbox.findFirst({ where: { id: row.id } }),
    );
    expect(cleared?.prepared).toBeNull();
    expect(await run(quotes.emails(quote.id))).toHaveLength(1);
  });

  it('does not send an uncertain row after Resend can forget its key', async () => {
    const { deliveries } = await invitation();
    const row = deliveries[0];
    if (!row) throw new Error('No invitation');
    await run(
      db
        .update(tables.outbox)
        .set({
          uncertain: true,
          firstAttemptAt: new Date(
            Date.now() - idempotencyWindow - 1000,
          ).toISOString(),
        })
        .where(eq(tables.outbox.id, row.id)),
    );
    fetchMail.mockClear();
    expect((await run(mailer.send(row.id)))?.state).toBe('failed');
    expect(fetchMail).not.toHaveBeenCalled();
  });

  it('keeps unknown provider errors private and delivery uncertain', async () => {
    const { deliveries } = await invitation();
    const row = deliveries[0];
    if (!row) throw new Error('No invitation');
    fetchMail.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            name: 'lucy@example.test',
            message: 'private message content',
          }),
          { status: 502 },
        ),
    );
    const result = await run(mailer.send(row.id));
    expect(result?.lastError).toContain('uncertain_delivery');
    expect(result?.lastError).not.toContain('lucy@example.test');
    expect(result?.lastError).not.toContain('private message content');
    expect(
      (await run(db.query.outbox.findFirst({ where: { id: row.id } })))
        ?.uncertain,
    ).toBe(true);
  });

  it('aborts the provider request when its sending effect stops', async () => {
    const { deliveries } = await invitation();
    const row = deliveries[0];
    if (!row) throw new Error('No invitation');
    const started = await run(Deferred.make<void>());
    let signal: AbortSignal | null | undefined;
    fetchMail.mockImplementation(
      (_, options) =>
        new Promise<Response>((_, reject) => {
          signal = options?.signal;
          signal?.addEventListener(
            'abort',
            () => reject(new Error('Aborted')),
            { once: true },
          );
          Effect.runSync(Deferred.succeed(started, undefined));
        }),
    );
    const sending = Effect.runFork(mailer.send(row.id));
    await run(Deferred.await(started));
    await run(Fiber.interrupt(sending));
    expect(signal?.aborted).toBe(true);
    const claimed = await run(
      db.query.outbox.findFirst({ where: { id: row.id } }),
    );
    expect(claimed).toMatchObject({ state: 'pending', uncertain: true });
    expect(claimed?.lockedUntil).not.toBeNull();
  });

  it('refuses a prepared invitation after the owner closes its link', async () => {
    const { quote, deliveries } = await invitation();
    const row = deliveries[0];
    if (!row) throw new Error('No invitation');
    fetchMail.mockImplementation(async () => {
      throw new Error('Offline');
    });
    await run(mailer.send(row.id));
    await run(quotes.revoke(quote.id, owner));
    fetchMail.mockClear();
    expect(await run(mailer.retry(quote.id, row.id, owner))).toMatchObject({
      state: 'failed',
      lastError: expect.stringContaining('closed'),
    });
    expect(fetchMail).not.toHaveBeenCalled();
  });

  it('sums encoded attachments and rejects the whole oversized message', async () => {
    const body = {
      from: 'mail@example.test',
      subject: 'Quote',
      html: '<p>Quote</p>',
      text: 'Quote',
      attachments: [
        {
          filename: 'a.pdf',
          content: 'A'.repeat(20_000_000),
          contentType: 'application/pdf',
        },
        {
          filename: 'b.pdf',
          content: 'A'.repeat(20_000_000),
          contentType: 'application/pdf',
        },
      ],
    };
    expect(await run(Effect.flip(boundedMail(body)))).toMatchObject({
      _tag: 'MailFailure',
      permanent: true,
      message: expect.stringContaining('40 MB'),
    });
    expect(
      await run(
        Effect.flip(
          boundedMail({
            ...body,
            attachments: [],
            text: 'é'.repeat(7_000_000),
          }),
        ),
      ),
    ).toMatchObject({ permanent: true });
  });

  it('retries a customer confirmation even when the owner notice already went out', async () => {
    const { quote } = await invitation();
    fetchMail.mockImplementation(async () => accepted());
    await run(mailer.quote(quote.id));
    const view = await run(quotes.view(quote.id));
    await run(
      quotes.respond(
        quote.id,
        {
          outcome: 'declined',
          name: 'Lucy Martin',
          earlyStart: false,
          language: 'es',
          digest: view.digests.es,
          plan: null,
          signature: null,
        },
        { address: '', agent: 'test' },
        {
          url: 'https://example.test/quote',
          workspaceUrl: 'https://example.test/invoices',
        },
      ),
    );
    const rows = await run(outbox.deliveries(quote.id));
    const customer = rows.find((mail) => mail.kind === 'quote-answer');
    const ownerNotice = rows.find((mail) => mail.kind === 'quote-answered');
    if (!customer || !ownerNotice) throw new Error('No answer mail');
    fetchMail.mockImplementation(async () => {
      throw new Error('Offline');
    });
    expect((await run(mailer.send(customer.id)))?.state).toBe('pending');
    fetchMail.mockImplementation(async () => accepted());
    expect((await run(mailer.send(ownerNotice.id)))?.state).toBe('sent');
    expect((await run(quotes.view(quote.id))).response?.confirmedAt).toBeNull();
    expect(await run(mailer.retry(quote.id, customer.id, owner))).toMatchObject(
      { state: 'sent', attempts: 2 },
    );
    expect(
      (await run(quotes.view(quote.id))).response?.confirmedAt,
    ).not.toBeNull();
  });

  it('never sends expired sign-in codes and clears their secret content', async () => {
    const key = `expired-code/${crypto.randomUUID()}`;
    await run(
      outbox.enqueue([
        {
          invoiceId: null,
          kind: 'sign-in-code',
          recipient: 'lucy@example.test',
          payload: {
            _tag: 'Code',
            code: '123456',
            language: 'en',
            accountUrl: 'https://example.test/account',
          },
          key,
          expiresAt: new Date(Date.now() - codeLifetime * 1000).toISOString(),
        },
      ]),
    );
    const mail = await run(outbox.byKey(key));
    if (!mail) throw new Error('No sign-in email');
    fetchMail.mockClear();
    expect((await run(mailer.send(mail.id)))?.state).toBe('failed');
    expect(fetchMail).not.toHaveBeenCalled();
    const row = await run(
      db.query.outbox.findFirst({ where: { id: mail.id } }),
    );
    expect(row?.prepared).toBeNull();
    expect(row?.payload).toMatchObject({ code: '' });
  });

  it('authenticates scheduled delivery before it reads the outbox', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const request = (signature: string) =>
      new Request(`https://example.test${mailRetryPath}`, {
        method: 'POST',
        headers: {
          [mailRetryTimestampHeader]: timestamp,
          [mailRetrySignatureHeader]: signature,
        },
      });
    expect(
      await runtime.runPromise(
        Effect.flip(
          retryDueMail.pipe(
            Effect.provideService(CurrentRequest, request('forged')),
          ),
        ),
      ),
    ).toMatchObject({ _tag: 'Refused', status: 401 });
    fetchMail.mockImplementation(async () => accepted());
    const response = await runtime.runPromise(
      retryDueMail.pipe(
        Effect.provideService(
          CurrentRequest,
          request(mailRetrySignature(secret, timestamp)),
        ),
      ),
    );
    expect(response.status).toBe(200);
  });
});

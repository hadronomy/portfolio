import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvoiceDatabase } from '@portfolio/invoices/database';
import { specimen } from '@portfolio/invoices/fixtures';
import { OwnerDid } from '@portfolio/invoices/model';
import { InvoiceStore } from '@portfolio/invoices/store';
import { links } from '@portfolio/invoices/tables';
import { ConfigProvider, Effect, Layer, ManagedRuntime } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Auth } from '~/server/auth.server';
import { appLayer } from '~/server/runtime.server';

// The app's real auth configuration over a throwaway local database: the
// customer half end to end, from an open payment link to a signed-in session.

const origin = 'http://127.0.0.1:4321';
let directory: string;
let handler: (request: Request) => Promise<Response>;
let dispose: () => Promise<void>;
/**
 * The codes sent so far, by address. Development without Resend writes
 * each email to the data folder, with a text copy that heads it.
 */
async function codes() {
  const folder = join(directory, 'mail');
  const sent = new Map<string, string>();
  for (const name of await readdir(folder).catch(() => []))
    if (name.endsWith('-sign-in-code.txt')) {
      const mail = await readFile(join(folder, name), 'utf8');
      const to = /^To: (\S+)$/m.exec(mail)?.[1];
      const code = /^Subject: (\d{6})/m.exec(mail)?.[1];
      if (to && code) sent.set(to, code);
    }
  return sent;
}

const post = (path: string, body: unknown, cookie = '') =>
  handler(
    new Request(`${origin}/invoices/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        host: '127.0.0.1:4321',
        ...(cookie && { cookie }),
      },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'invoices-auth-'));
  // The whole server, as it runs, over settings this test hands it.
  const app = ManagedRuntime.make(
    appLayer.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            INVOICE_DATA_DIRECTORY: directory,
            NODE_ENV: 'development',
          }),
        ),
      ),
    ),
  );
  dispose = () => app.dispose();
  const owner = OwnerDid.make('owner');
  const base = specimen();
  // An issued invoice billed to the customer, with a payment link open.
  await app.runPromise(
    Effect.gen(function* () {
      const store = yield* InvoiceStore;
      const db = yield* InvoiceDatabase;
      const draft = yield* store.save(
        {
          ...base,
          data: {
            ...base.data,
            customer: { ...base.data.customer, email: 'Client@Acme.test' },
          },
        },
        owner,
      );
      const issued = yield* store.issue(
        { id: draft.id, revision: draft.revision, key: crypto.randomUUID() },
        owner,
      );
      yield* db.insert(links).values({
        tokenHash: crypto.randomUUID(),
        invoiceId: issued.id,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        createdAt: new Date().toISOString(),
      });
    }),
  );
  handler = (request) =>
    app.runPromise(Auth.use((auth) => auth.handle(request)));
}, 30_000);

afterAll(async () => {
  await dispose();
  await rm(directory, { recursive: true, force: true });
});

describe('customer accounts', () => {
  it('signs in an address billed on an invoice with an open link', async () => {
    const sent = await post('/email-otp/send-verification-otp', {
      email: 'client@acme.test',
      type: 'sign-in',
    });
    expect(sent.status).toBe(200);
    const code = (await codes()).get('client@acme.test');
    expect(code).toMatch(/^\d{6}$/);

    const signedIn = await post('/sign-in/email-otp', {
      email: 'client@acme.test',
      otp: code,
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get('set-cookie')?.split(';')[0] ?? '';
    const session = await handler(
      new Request(`${origin}/invoices/auth/get-session`, {
        headers: { cookie, host: '127.0.0.1:4321' },
      }),
    );
    expect(await session.json()).toMatchObject({
      user: { email: 'client@acme.test', emailVerified: true },
    });
  });

  it('sends nothing to an address with no open link, and opens nothing for it', async () => {
    const sent = await post('/email-otp/send-verification-otp', {
      email: 'stranger@acme.test',
      type: 'sign-in',
    });
    // The same answer as for a real customer, so nobody learns who is one.
    expect(sent.status).toBe(200);
    expect((await codes()).has('stranger@acme.test')).toBe(false);
    const guessed = await post('/sign-in/email-otp', {
      email: 'stranger@acme.test',
      otp: '000000',
    });
    expect(guessed.status).toBe(400);
  });

  it('keeps every other way in closed', async () => {
    const response = await post('/sign-up/email', {
      email: 'client@acme.test',
      password: 'a-long-enough-password',
      name: 'Client',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

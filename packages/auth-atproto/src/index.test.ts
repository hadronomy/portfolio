import { JoseKey } from '@atproto/oauth-client-node';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';
import { ATPROTO_CALLBACK_ERRORS, atproto } from './index';
import { verificationStore } from './store';

const secret = 'a-test-secret-that-is-long-enough-to-pass-checks';

function instance(baseURL: string, keys: readonly string[] = []) {
  const db: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL,
    basePath: '/auth',
    secret,
    database: memoryAdapter(db),
    rateLimit: { enabled: false },
    logger: { disabled: true },
    plugins: [atproto({ clientName: 'Test', keys })],
  });
  return { auth, db };
}

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(url).origin,
    },
    body: JSON.stringify(body),
  });

describe('atproto', () => {
  it('asks for 127.0.0.1 when development runs on localhost', async () => {
    const { auth } = instance('http://localhost:4321');
    const response = await auth.handler(
      post('http://localhost:4321/auth/sign-in/atproto', {
        handle: 'alice.test',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'LOOPBACK_HOST_REQUIRED',
    });
  });

  it('refuses plain HTTP outside loopback', async () => {
    const { auth } = instance('http://invoices.test');
    const response = await auth.handler(
      post('http://invoices.test/auth/sign-in/atproto', {
        handle: 'alice.test',
      }),
    );
    expect(await response.json()).toMatchObject({ code: 'HTTPS_REQUIRED' });
  });

  it('refuses to start over HTTPS without a signing key', async () => {
    const { auth } = instance('https://invoices.test');
    await expect(auth.$context).rejects.toThrow(/signing key/);
  });

  it('publishes confidential client metadata and only the public key', async () => {
    const key = await JoseKey.generate(['ES256'], 'test-1');
    const { auth } = instance('https://invoices.test', [
      JSON.stringify(key.privateJwk),
    ]);
    const metadata = await (
      await auth.handler(
        new Request('https://invoices.test/auth/atproto/client-metadata.json'),
      )
    ).json();
    expect(metadata).toMatchObject({
      client_id: 'https://invoices.test/auth/atproto/client-metadata.json',
      client_name: 'Test',
      redirect_uris: ['https://invoices.test/auth/atproto/callback'],
      scope: 'atproto',
      token_endpoint_auth_method: 'private_key_jwt',
      dpop_bound_access_tokens: true,
    });
    const jwks = await (
      await auth.handler(
        new Request('https://invoices.test/auth/atproto/jwks.json'),
      )
    ).json();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kid: 'test-1', kty: 'EC' });
    expect(jwks.keys[0]).not.toHaveProperty('d');
  });

  it('sends a callback it cannot finish to the error page', async () => {
    const { auth } = instance('http://127.0.0.1:4321');
    const response = await auth.handler(
      new Request(
        'http://127.0.0.1:4321/auth/atproto/callback?state=forged&code=x&iss=https://pds.test',
      ),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/auth/error');
    expect(location.searchParams.get('error')).toBe(
      ATPROTO_CALLBACK_ERRORS.AUTHORIZATION_FAILED,
    );
  });

  it('adds a did that users cannot set themselves', async () => {
    const { auth } = instance('http://127.0.0.1:4321');
    const context = await auth.$context;
    expect(context.tables.user?.fields.did).toMatchObject({
      unique: true,
      input: false,
    });
  });
});

describe('verificationStore', () => {
  it('keeps values encrypted and hands them back until they expire', async () => {
    const { auth, db } = instance('http://127.0.0.1:4321');
    const context = await auth.$context;
    const store = verificationStore<{ token: string }>(
      context,
      'session',
      60_000,
    );
    await store.set('did:plc:alice', { token: 'sensitive' });
    expect(JSON.stringify(db.verification)).not.toContain('sensitive');
    expect(await store.get('did:plc:alice')).toEqual({ token: 'sensitive' });
    await store.set('did:plc:alice', { token: 'replaced' });
    expect(db.verification).toHaveLength(1);
    await store.del('did:plc:alice');
    expect(await store.get('did:plc:alice')).toBeUndefined();

    const expired = verificationStore<string>(context, 'state', -1);
    await expired.set('flow', 'gone');
    expect(await expired.get('flow')).toBeUndefined();
  });
});

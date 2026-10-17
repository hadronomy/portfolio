import { createHash, createHmac, randomUUID } from 'node:crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { Postgres } from '@portfolio/database';
import { PostgresLocal } from '@portfolio/database/local';
import { betterAuth } from 'better-auth';
import { ManagedRuntime } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { step } from '~/features/agent/step';
import { migrations } from '~/features/auth/migrations';
import { authOptions, ownerDid } from '~/features/auth/options';
import { authNamespace } from '~/features/auth/shared';
import * as tables from '~/features/auth/tables';

// The connect pages as the provider meets them: an agent's authorization
// request, the owner's sign-in carried on, and the owner's answer, against
// the real provider on a throwaway database. Each answer goes through the
// same reading the pages use, so a provider upgrade that changes what it
// sends fails here, not on the owner's screen.

const origin = 'http://127.0.0.1:4321';
const secret = 'test-only-secret-at-least-thirty-two-characters';
const callback = 'http://localhost:9/callback';
const runtime = ManagedRuntime.make(
  PostgresLocal.layer({ migrations: [migrations] }),
);
let auth: { handler: (request: Request) => Promise<Response> };
let cookie: string;

/** A session cookie, signed as better-call signs it. */
const signed = (value: string) =>
  `${value}.${createHmac('sha256', secret).update(value).digest('base64')}`;

const authorizeUrl = () =>
  `${origin}/invoices/auth/oauth2/authorize?${new URLSearchParams({
    client_id: 'agent',
    redirect_uri: callback,
    response_type: 'code',
    scope: 'invoices',
    state: 'state',
    code_challenge: createHash('sha256')
      .update('v'.repeat(64))
      .digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${origin}/invoices/mcp`,
  })}`;

/** A page the provider sends the browser to, and the signed request it carries. */
async function open(withSession: boolean) {
  const response = await auth.handler(
    new Request(authorizeUrl(), {
      headers: {
        accept: 'text/html',
        'sec-fetch-mode': 'navigate',
        ...(withSession && { cookie }),
      },
    }),
  );
  const page = new URL(response.headers.get('location') ?? '', origin);
  // What the client plugin posts back: the signed parameters alone.
  const names = new Set(page.searchParams.getAll('ba_param'));
  const query = new URLSearchParams();
  for (const [key, value] of page.searchParams)
    if (key === 'sig' || key === 'ba_param' || names.has(key))
      query.append(key, value);
  return { path: page.pathname, query: query.toString() };
}

/** A page's POST, answered as the auth client hands answers to the page. */
async function post(path: string, body: object) {
  const response = await auth.handler(
    new Request(`${origin}/invoices/auth${path}`, {
      method: 'POST',
      headers: {
        origin,
        cookie,
        'content-type': 'application/json',
        'sec-fetch-mode': 'cors',
      },
      body: JSON.stringify(body),
    }),
  );
  const json: unknown = await response.json();
  return response.ok
    ? { data: json, error: null }
    : { data: null, error: { ...(json as object), status: response.status } };
}

beforeAll(async () => {
  const postgres = await runtime.runPromise(Postgres.Postgres);
  const database = postgres.promise(tables.authRelations);
  const instance = betterAuth({
    ...authOptions({
      origin,
      admits: async () => false,
      sendCode: async () => {},
      atprotoKeys: [],
    }),
    baseURL: origin,
    secret,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: tables,
      schemaName: authNamespace,
      transaction: true,
    }),
  });
  const context = await instance.$context;
  auth = instance;
  const now = new Date();
  const userId = randomUUID();
  await database.insert(tables.user).values({
    id: userId,
    name: 'owner',
    email: 'owner@placeholder.invalid',
    did: ownerDid,
    createdAt: now,
    updatedAt: now,
  });
  // As the mcp plugin registers an agent: a public client, tied to the MCP
  // resource, with the provider's scopes.
  await database.insert(tables.oauthClient).values({
    id: randomUUID(),
    clientId: 'agent',
    name: 'Agent',
    redirectUris: [callback],
    tokenEndpointAuthMethod: 'none',
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    scopes: ['openid', 'offline_access', 'invoices'],
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(tables.oauthClientResource).values({
    id: randomUUID(),
    clientId: 'agent',
    resourceId: `${origin}/invoices/mcp`,
    createdAt: now,
  });
  const token = randomUUID().replaceAll('-', '');
  await database.insert(tables.session).values({
    id: randomUUID(),
    token,
    userId,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
  });
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(signed(token))}`;
}, 30_000);

afterAll(() => runtime.dispose());

describe('connecting an agent', () => {
  it('sends the owner from sign-in on to the consent page', async () => {
    const login = await open(false);
    expect(login.path).toBe('/invoices/connect');
    const answer = await post('/oauth2/continue', {
      selected: true,
      oauth_query: login.query,
    });
    expect(step(answer)).toEqual({ kind: 'leaving' });
    expect(new URL((answer.data as { url: string }).url, origin).pathname).toBe(
      '/invoices/connect/consent',
    );
  });

  it('answers the first Allow with the agent callback and its code', async () => {
    const consent = await open(true);
    expect(consent.path).toBe('/invoices/connect/consent');
    const answer = await post('/oauth2/consent', {
      accept: true,
      oauth_query: consent.query,
    });
    expect(step(answer)).toEqual({ kind: 'leaving' });
    const url = new URL((answer.data as { url: string }).url);
    expect(`${url.origin}${url.pathname}`).toBe(callback);
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('code')).toBeTruthy();
  });

  it('says an altered request expired', async () => {
    const login = await open(false);
    expect(login.query).toContain('sig=');
    const answer = await post('/oauth2/continue', {
      selected: true,
      oauth_query: login.query.replace(/sig=[^&]+/, 'sig=forged'),
    });
    expect(step(answer)).toEqual({
      kind: 'stopped',
      problem: 'This request has expired. Start again from your agent.',
    });
  });
});

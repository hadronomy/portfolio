import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  NodeOAuthClient,
  OAuthCallbackError,
} from '@atproto/oauth-client-node';
import { OwnerDid } from '@portfolio/invoices/model';
import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from '@tanstack/react-start/server';
import { Schema } from 'effect';
import { applicationOrigin } from './origin.server';
import {
  appConfig,
  NodeSessionCodec,
  NodeStateCodec,
  runtime,
} from './runtime.server';

export { OwnerDid };
export const ownerDid: OwnerDid = OwnerDid.make(
  'did:plc:tvgjv46t4ebxbrvekr2vrnls',
);
const sessionCookie = 'invoice-session';
const nonceCookie = 'invoice-login';
const day = 86_400_000;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** Resolves the public application origin for this request from the process config, keeping OAuth callbacks on the same host. */
export function origin() {
  const settings = appConfig();
  return applicationOrigin(getRequest(), {
    configured: settings.origin,
    production: settings.production,
  });
}

/** Rejects cross-origin mutations so only the invoice workspace itself can change its data. */
export function requireSameOrigin() {
  const request = getRequest();
  if (request.headers.get('origin') !== origin())
    throw new Response('Invalid request origin.', { status: 403 });
}

const cookies = () => ({
  httpOnly: true,
  secure: origin().startsWith('https:'),
  sameSite: 'lax' as const,
  path: '/',
});

const BrowserSession = Schema.Struct({ did: Schema.String });

async function browserSessions() {
  return (await runtime()).vault('browser', 7 * day, BrowserSession);
}

/** Returns the signed-in owner identity, or null when no valid browser session exists. */
export async function identity() {
  const token = getCookie(sessionCookie);
  if (!token) return null;
  const session = await (await browserSessions()).get(hash(token));
  return session?.did === ownerDid
    ? { did: ownerDid, handle: 'hadronomy.com' }
    : null;
}

/** Returns the owner DID for this request, rejecting anyone else with a 401 before any invoice data loads. */
export async function requireOwner(): Promise<OwnerDid> {
  const user = await identity();
  if (!user) throw new Response('Sign in to access invoices.', { status: 401 });
  return user.did;
}

async function createClient(base: string) {
  const { vault } = await runtime();
  const stateStore = vault('oauth-state', 10 * 60_000, NodeStateCodec);
  const sessionStore = vault('oauth-session', 90 * day, NodeSessionCodec);
  const callback = `${base}/invoices/auth/callback`;
  if (base.startsWith('http:')) {
    return new NodeOAuthClient({
      clientMetadata: buildAtprotoLoopbackClientMetadata({
        scope: 'atproto',
        redirect_uris: [callback],
      }),
      stateStore,
      sessionStore,
    });
  }
  const keys = vault('oauth-key', 3650 * day, Schema.String);
  const saved = await keys.get('signing');
  const key = saved
    ? await JoseKey.fromJWK(saved)
    : await JoseKey.generate(['ES256'], 'invoices-1');
  if (!saved) await keys.set('signing', JSON.stringify(key.privateJwk));
  return new NodeOAuthClient({
    clientMetadata: {
      client_id: `${base}/invoices/auth/client-metadata.json`,
      client_name: 'Hadronomy Invoices',
      client_uri: `${base}/invoices`,
      redirect_uris: [callback],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'atproto',
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      application_type: 'web',
      dpop_bound_access_tokens: true,
      jwks_uri: `${base}/invoices/auth/jwks.json`,
    },
    keyset: [key],
    stateStore,
    sessionStore,
  });
}

const clients = new Map<string, ReturnType<typeof createClient>>();
/** Returns the cached OAuth client for the current origin, rebuilding it when creation fails. */
export function oauthClient() {
  const base = origin();
  let client = clients.get(base);
  if (!client) {
    client = createClient(base).catch((error) => {
      clients.delete(base);
      throw error;
    });
    clients.set(base, client);
  }
  return client;
}

/** Starts the atproto sign-in flow for the workspace handle and remembers the nonce in a short-lived cookie. */
export async function signIn() {
  requireSameOrigin();
  const nonce = randomBytes(32).toString('base64url');
  const url = await (await oauthClient()).authorize('hadronomy.com', {
    scope: 'atproto',
    state: nonce,
  });
  setCookie(nonceCookie, nonce, { ...cookies(), maxAge: 600 });
  return url.toString();
}

/** Finishes the atproto sign-in flow, keeps only the workspace owner session, and redirects back to the workspace. */
export async function callback(request: Request) {
  const nonce = getCookie(nonceCookie);
  deleteCookie(nonceCookie, cookies());
  if (!nonce)
    throw new Response('The sign-in attempt expired. Start again.', {
      status: 400,
    });
  const client = await oauthClient();
  const result = await client
    .callback(new URL(request.url).searchParams)
    .catch((error: unknown) => {
      if (error instanceof OAuthCallbackError)
        throw new Response(
          'Sign-in failed or expired. Start again at /invoices.',
          { status: 400 },
        );
      throw error;
    });
  const { session, state } = result;
  if (
    !state ||
    state.length !== nonce.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(nonce))
  )
    throw new Response('Invalid sign-in attempt.', { status: 403 });
  if (session.did !== ownerDid) {
    await client.revoke(session.did);
    throw new Response('This workspace belongs to hadronomy.com.', {
      status: 403,
    });
  }
  const old = getCookie(sessionCookie);
  const sessions = await browserSessions();
  if (old) await sessions.del(hash(old));
  const token = randomBytes(32).toString('base64url');
  await sessions.set(hash(token), { did: ownerDid });
  setCookie(sessionCookie, token, { ...cookies(), maxAge: 7 * 86400 });
  return new Response(null, {
    status: 303,
    headers: { location: `${origin()}/invoices` },
  });
}

/** Signs the owner out of this browser by dropping the session cookie and its server record. */
export async function signOut() {
  requireSameOrigin();
  const token = getCookie(sessionCookie);
  if (token) await (await browserSessions()).del(hash(token));
  deleteCookie(sessionCookie, cookies());
}

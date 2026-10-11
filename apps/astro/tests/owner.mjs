import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { vi } from 'vitest';

// Signs in to the invoices through the real AT Protocol plugin and
// better-auth. Only the exchange with the account's server is faked: it
// answers as `did`. The dev server runs in this process, so the spy reaches
// the client the plugin uses.

export const ownerDid = 'did:plc:tvgjv46t4ebxbrvekr2vrnls';

async function oauthClient() {
  const require = createRequire(
    new URL('../../../packages/auth-atproto/package.json', import.meta.url),
  );
  const module = await import(
    pathToFileURL(require.resolve('@atproto/oauth-client-node')).href
  );
  return module.NodeOAuthClient;
}

/** The callback's response, the session cookie it set, and the faked grant's sign-out. */
export async function signIn(origin, did = ownerDid) {
  const NodeOAuthClient = await oauthClient();
  const signOut = vi.fn(async () => {});
  vi.spyOn(NodeOAuthClient.prototype, 'callback').mockImplementation(
    async (params) => ({
      session: { did, signOut },
      state: params.get('state'),
    }),
  );
  const started = await fetch(`${origin}/invoices/auth/sign-in/atproto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      handle: 'hadronomy.com',
      callbackURL: '/invoices',
      errorCallbackURL: '/invoices',
      disableRedirect: true,
    }),
  });
  const flow = started.headers
    .getSetCookie()
    .find((cookie) => cookie.includes('atproto_state='))
    ?.split(';')[0];
  if (!flow) throw new Error(`Sign-in did not start: ${started.status}`);
  const nonce = decodeURIComponent(flow.split('=')[1] ?? '').split('.')[0];
  const state = encodeURIComponent(
    JSON.stringify({ nonce, callbackURL: '/invoices' }),
  );
  const response = await fetch(
    `${origin}/invoices/auth/atproto/callback?state=${state}&code=test`,
    { headers: { cookie: flow }, redirect: 'manual' },
  );
  const session = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('better-auth.session_token='));
  return {
    response,
    session,
    cookie: session?.split(';')[0] ?? '',
    signOut,
  };
}

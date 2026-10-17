import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { vi } from 'vitest';

// Signs in to the invoices through the real AT Protocol plugin and
// better-auth. Only the exchange with the account's server is faked: it
// answers as `did`. The dev server runs in this process, and this app pins
// the client's version the plugin uses, so the spy reaches the plugin's copy.

export const ownerDid = 'did:plc:tvgjv46t4ebxbrvekr2vrnls';

/** The callback's response, the session cookie it set, and the faked grant's sign-out. */
export async function signIn(origin, did = ownerDid) {
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

import {
  type NodeOAuthClient,
  OAuthCallbackError,
  type OAuthSession,
} from '@atproto/oauth-client-node';
import type { AuthContext, BetterAuthPlugin } from '@better-auth/core';
import { BetterAuthError } from '@better-auth/core/error';
import { createPlaceholderEmail } from '@better-auth/core/utils/email';
import { HIDE_METADATA } from 'better-auth';
import {
  APIError,
  createAuthEndpoint,
  isAPIError,
  originCheck,
} from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { constantTimeEqual, generateRandomString } from 'better-auth/crypto';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import * as z from 'zod';
import { ATPROTO_CALLBACK_ERRORS, ATPROTO_ERROR_CODES } from './error-codes';
import { createOAuthClient, paths, scope } from './oauth-client';

export { ATPROTO_CALLBACK_ERRORS, ATPROTO_ERROR_CODES };

export interface AtprotoOptions {
  /** The name an account's server shows when it asks the person to approve the sign-in. */
  readonly clientName: string;
  /**
   * Private ES256 keys as JWK JSON, each with its own `kid`. The first signs
   * token requests; keep a retired key listed until its sessions are gone.
   * HTTPS deployments need at least one. Loopback development needs none.
   */
  readonly keys?: readonly string[] | undefined;
}

/**
 * What the account's server vouched for. `user.validateUserInfo` receives it
 * as `source.oauth.profile` on every sign-in, so admission can key on the
 * DID, which never changes, rather than the handle, which can.
 */
export interface AtprotoProfile {
  readonly did: string;
  /** The handle, when it still resolves back to the same DID. */
  readonly handle: string | null;
}

/** Where a sign-in goes when it ends, carried through the flow as the OAuth client's app state. */
const Flow = z.object({
  nonce: z.string(),
  callbackURL: z.string(),
  errorURL: z.string().optional(),
  newUserURL: z.string().optional(),
});
type Flow = z.infer<typeof Flow>;

const readFlow = (state: string | null | undefined): Flow | undefined => {
  if (!state) return undefined;
  try {
    return Flow.parse(JSON.parse(state));
  } catch {
    return undefined;
  }
};

const signInBody = z.object({
  /** A handle such as `alice.bsky.social`, a DID, or the URL of a PDS. */
  handle: z.string().min(1).max(2048),
  callbackURL: z.string().optional(),
  errorCallbackURL: z.string().optional(),
  newUserCallbackURL: z.string().optional(),
  /** Return the authorization URL without the `Location` header. */
  disableRedirect: z.boolean().optional(),
});

const stateCookie = 'atproto_state';

/**
 * Sign in with an AT Protocol account: any handle, DID, or PDS, through the
 * protocol's OAuth profile with PAR, PKCE, and DPoP.
 *
 * The plugin proves who someone is and keeps nothing else. It requests the
 * identity-only `atproto` scope and revokes the grant inside the callback
 * that receives it, so no token outlives the sign-in. The DID becomes the
 * account key and the user's `did` field; the handle becomes the name.
 * Who may sign in is the app's call, made in `user.validateUserInfo`.
 *
 * @example
 * ```ts
 * import { atproto, type AtprotoProfile } from '@portfolio/auth-atproto';
 *
 * export const auth = betterAuth({
 *   plugins: [atproto({ clientName: 'Invoices', keys: [process.env.ATPROTO_KEY!] })],
 *   user: {
 *     validateUserInfo: ({ source }) => {
 *       const profile = source.oauth?.profile as AtprotoProfile | undefined;
 *       if (source.oauth?.providerId === 'atproto' && profile?.did !== ownerDid)
 *         return { error: 'not_owner' };
 *     },
 *   },
 * });
 *
 * // In the browser, with `atprotoClient()` installed:
 * await authClient.signIn.atproto({ handle: 'alice.bsky.social', callbackURL: '/' });
 * ```
 */
export const atproto = (options: AtprotoOptions) => {
  const settings = { clientName: options.clientName, keys: options.keys ?? [] };
  // One client per base URL: a dynamic base URL can resolve to several, and
  // building a client imports keys, so it happens once each.
  const clients = new Map<string, Promise<NodeOAuthClient>>();
  const clientFor = (context: AuthContext) => {
    let client = clients.get(context.baseURL);
    if (!client) {
      client = createOAuthClient(context, settings);
      client.catch(() => clients.delete(context.baseURL));
      clients.set(context.baseURL, client);
    }
    return client;
  };

  return {
    id: 'atproto',
    init(context) {
      // A fixed HTTPS base URL is known now, so a missing key fails the
      // deploy instead of the first sign-in.
      const { baseURL } = context.options;
      if (
        typeof baseURL === 'string' &&
        baseURL.startsWith('https:') &&
        settings.keys.length === 0
      )
        throw new BetterAuthError(
          ATPROTO_ERROR_CODES.SIGNING_KEYS_MISSING.message,
        );
    },
    schema: {
      user: {
        fields: {
          // Never writable through the user's own update endpoint: the app
          // authorizes on it.
          did: { type: 'string', required: false, unique: true, input: false },
        },
      },
    },
    $ERROR_CODES: ATPROTO_ERROR_CODES,
    rateLimit: [
      {
        pathMatcher: (path) => path === '/sign-in/atproto',
        window: 60,
        max: 10,
      },
    ],
    endpoints: {
      signInAtproto: createAuthEndpoint(
        '/sign-in/atproto',
        {
          method: 'POST',
          body: signInBody,
          use: [
            originCheck((ctx) =>
              [
                ctx.body.callbackURL,
                ctx.body.errorCallbackURL,
                ctx.body.newUserCallbackURL,
              ].filter((url): url is string => !!url),
            ),
          ],
          metadata: {
            openapi: {
              description:
                'Start signing in with an AT Protocol handle, DID, or PDS',
            },
          },
        },
        async (ctx) => {
          const client = await clientFor(ctx.context);
          const nonce = generateRandomString(32);
          const flow: Flow = {
            nonce,
            callbackURL: ctx.body.callbackURL ?? '/',
            ...(ctx.body.errorCallbackURL && {
              errorURL: ctx.body.errorCallbackURL,
            }),
            ...(ctx.body.newUserCallbackURL && {
              newUserURL: ctx.body.newUserCallbackURL,
            }),
          };
          const url = await client
            .authorize(ctx.body.handle, {
              scope,
              state: JSON.stringify(flow),
            })
            .catch((error: unknown) => {
              ctx.context.logger.warn(
                'AT Protocol authorization failed',
                error,
              );
              throw APIError.from(
                'BAD_REQUEST',
                ATPROTO_ERROR_CODES.ACCOUNT_NOT_REACHED,
              );
            });
          // The flow's state is stored server-side; this cookie ties the
          // callback to the browser that started it.
          const cookie = ctx.context.createAuthCookie(stateCookie, {
            maxAge: 600,
          });
          await ctx.setSignedCookie(
            cookie.name,
            nonce,
            ctx.context.secret,
            cookie.attributes,
          );
          const redirect = !ctx.body.disableRedirect;
          if (redirect) ctx.setHeader('Location', url.toString());
          return ctx.json({ url: url.toString(), redirect });
        },
      ),

      atprotoCallback: createAuthEndpoint(
        paths.callback,
        { method: 'GET', requireRequest: true, metadata: HIDE_METADATA },
        async (ctx) => {
          const params = new URL(ctx.request.url).searchParams;
          const cookie = ctx.context.createAuthCookie(stateCookie);
          const nonce = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          );
          expireCookie(ctx, cookie);
          const fallbackErrorURL =
            ctx.context.options.onAPIError?.errorURL ??
            `${ctx.context.baseURL}/error`;
          const fail = (code: string, flow?: Flow): never => {
            const target = new URL(
              flow?.errorURL ?? fallbackErrorURL,
              ctx.context.baseURL,
            );
            target.searchParams.set('error', code);
            throw ctx.redirect(target.toString());
          };

          let client: NodeOAuthClient;
          let session: OAuthSession;
          let flow: Flow | undefined;
          try {
            client = await clientFor(ctx.context);
            const result = await client.callback(params);
            session = result.session;
            flow = readFlow(result.state);
          } catch (error) {
            if (isAPIError(error)) throw error;
            ctx.context.logger.warn('AT Protocol callback failed', error);
            return fail(
              params.get('error') === 'access_denied'
                ? ATPROTO_CALLBACK_ERRORS.ACCESS_DENIED
                : ATPROTO_CALLBACK_ERRORS.AUTHORIZATION_FAILED,
              error instanceof OAuthCallbackError
                ? readFlow(error.state)
                : undefined,
            );
          }

          try {
            if (!flow || !nonce || !constantTimeEqual(nonce, flow.nonce))
              return fail(ATPROTO_CALLBACK_ERRORS.STATE_MISMATCH, flow);
            const identity = await client.identityResolver
              .resolve(session.did)
              .catch(() => null);
            const handle =
              identity && identity.handle !== 'handle.invalid'
                ? identity.handle
                : null;
            const profile: AtprotoProfile = { did: session.did, handle };
            const signedIn = await handleOAuthUserInfo(ctx, {
              userInfo: {
                id: session.did,
                name: handle ?? session.did,
                email: placeholderEmail(session.did),
                emailVerified: false,
              },
              account: { providerId: 'atproto', accountId: session.did },
              callbackURL: flow.callbackURL,
              // Handles change; the name follows the current one.
              overrideUserInfo: true,
              source: {
                method: 'oauth',
                oauth: { providerId: 'atproto', profile: { ...profile } },
              },
            }).catch((error: unknown) => {
              if (isAPIError(error) && error.body?.code)
                fail(error.body.code, flow);
              throw error;
            });
            if (!signedIn.data)
              return fail(signedIn.error.replaceAll(' ', '_'), flow);
            let { user } = signedIn.data;
            // `did` is not provider input, so the shared OAuth path leaves
            // it alone; a first sign-in records it here.
            if (!('did' in user) || user.did !== session.did)
              user =
                (await ctx.context.internalAdapter.updateUser(user.id, {
                  did: session.did,
                })) ?? user;
            await setSessionCookie(ctx, {
              session: signedIn.data.session,
              user,
            });
            throw ctx.redirect(
              signedIn.isRegister && flow.newUserURL
                ? flow.newUserURL
                : flow.callbackURL,
            );
          } finally {
            await session.signOut().catch((error: unknown) => {
              ctx.context.logger.warn('AT Protocol revocation failed', error);
            });
          }
        },
      ),

      getAtprotoClientMetadata: createAuthEndpoint(
        paths.metadata,
        { method: 'GET', metadata: HIDE_METADATA },
        async (ctx) => ctx.json((await clientFor(ctx.context)).clientMetadata),
      ),

      getAtprotoJwks: createAuthEndpoint(
        paths.jwks,
        { method: 'GET', metadata: HIDE_METADATA },
        async (ctx) => ctx.json((await clientFor(ctx.context)).jwks),
      ),
    },
    options,
  } satisfies BetterAuthPlugin;
};

/**
 * better-auth requires an email; an AT Protocol account has none to share
 * under the identity scope. This one is stable per DID and cannot receive
 * mail, so no email flow can ever reach the account.
 */
function placeholderEmail(did: string) {
  return createPlaceholderEmail({
    identifier: did.slice('did:'.length).replace(/[^a-z0-9.-]/gi, '-'),
    namespace: 'atproto',
  });
}

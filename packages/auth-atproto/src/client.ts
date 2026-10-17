import type { BetterAuthClientPlugin } from 'better-auth/client';
import { ATPROTO_CALLBACK_ERRORS, ATPROTO_ERROR_CODES } from '#error-codes';
import type { atproto } from '#index';

export { ATPROTO_CALLBACK_ERRORS, ATPROTO_ERROR_CODES };

/**
 * The browser half of `atproto()`: adds `authClient.signIn.atproto`, typed
 * from the server plugin, and its error codes.
 *
 * @example
 * ```ts
 * const authClient = createAuthClient({ plugins: [atprotoClient()] });
 * const { error } = await authClient.signIn.atproto({ handle: 'alice.bsky.social' });
 * if (error?.code === ATPROTO_ERROR_CODES.ACCOUNT_NOT_REACHED.code) …
 * ```
 */
export const atprotoClient = () =>
  ({
    id: 'atproto',
    $InferServerPlugin: {} as ReturnType<typeof atproto>,
    $ERROR_CODES: ATPROTO_ERROR_CODES,
  }) satisfies BetterAuthClientPlugin;

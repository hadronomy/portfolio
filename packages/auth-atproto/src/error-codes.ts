import { defineErrorCodes } from '@better-auth/core/utils/error-codes';

/** Why `signIn.atproto` refused to start. Each arrives as `error.code` on the client. */
export const ATPROTO_ERROR_CODES = defineErrorCodes({
  ACCOUNT_NOT_REACHED: 'The account behind this handle could not be reached',
  LOOPBACK_HOST_REQUIRED:
    'Open the app at 127.0.0.1, not localhost, to sign in with AT Protocol',
  HTTPS_REQUIRED:
    'AT Protocol sign-in needs HTTPS outside loopback development',
  SIGNING_KEYS_MISSING:
    'AT Protocol sign-in over HTTPS needs at least one signing key',
});

/**
 * Why the callback sent the browser to the error URL, as its `?error=` code.
 * Rejections from `user.validateUserInfo` arrive under their own codes.
 */
export const ATPROTO_CALLBACK_ERRORS = {
  /** The person declined on their account's authorization screen. */
  ACCESS_DENIED: 'access_denied',
  /** The account's server or the code exchange failed. */
  AUTHORIZATION_FAILED: 'atproto_authorization_failed',
  /** The callback did not come from a sign-in this browser started. */
  STATE_MISMATCH: 'atproto_state_mismatch',
} as const;

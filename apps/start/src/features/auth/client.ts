import { atprotoClient } from '@portfolio/auth-atproto/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { authBasePath } from './shared';

/** The browser's handle on sign-in: `signIn.atproto` for the owner, `emailOtp` and `signIn.emailOtp` for customers. */
export const authClient = createAuthClient({
  basePath: authBasePath,
  plugins: [atprotoClient(), emailOTPClient()],
});

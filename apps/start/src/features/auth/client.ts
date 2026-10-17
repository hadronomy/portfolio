import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { atprotoClient } from '@portfolio/auth-atproto/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { authBasePath } from '~/features/auth/shared';

/**
 * The browser's handle on sign-in: `signIn.atproto` for the owner, `emailOtp`
 * and `signIn.emailOtp` for customers. The OAuth provider's plugin adds the
 * signed request an agent's sign-in carries to every POST the connect page
 * makes, so the provider knows which agent it answers.
 */
export const authClient = createAuthClient({
  basePath: authBasePath,
  plugins: [atprotoClient(), emailOTPClient(), oauthProviderClient()],
});

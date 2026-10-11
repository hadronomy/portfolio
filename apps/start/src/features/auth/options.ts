import { type AtprotoProfile, atproto } from '@portfolio/auth-atproto';
import type { Language } from '@portfolio/invoices/model';
import { OwnerDid } from '@portfolio/invoices/model';
import type { BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { codeLifetime } from '../../server/mail.server';
import { authBasePath, ownerHandle } from './shared';

// Who may use the invoices app, and how they prove it. Two kinds of people
// sign in. The owner uses their AT Protocol account and is recognised by DID
// alone. Customers prove they read the inbox their invoices are billed to,
// with a code sent there; an inbox can open an account only while one of its
// invoices has a payment link open. Every other way in is closed.

export const ownerDid: OwnerDid = OwnerDid.make(
  'did:plc:tvgjv46t4ebxbrvekr2vrnls',
);

/**
 * What the auth options need from the running app, as the promises
 * better-auth awaits. The server builds them from its Effect services.
 */
export interface AuthDependencies {
  /** Whether a new customer address may open an account. */
  readonly admits: (email: string) => Promise<boolean>;
  /** Sends a customer's sign-in code. */
  readonly sendCode: (message: {
    readonly to: string;
    readonly code: string;
    readonly language: Language;
  }) => Promise<void>;
  /** Private JWKs for AT Protocol sign-in over HTTPS. */
  readonly atprotoKeys: readonly string[];
}

/**
 * better-auth's options for this app, without where it runs: the database,
 * base URL, and secret come from the server. The schema CLI builds from the
 * same function (see auth.config.ts), so generated tables always match the
 * plugins that use them.
 */
export const authOptions = (deps: AuthDependencies) =>
  ({
    appName: 'Hadronomy Invoices',
    basePath: authBasePath,
    rateLimit: { storage: 'database' },
    onAPIError: { errorURL: '/invoices' },
    user: {
      validateUserInfo: async ({ user, source }) => {
        if (
          source.method === 'oauth' &&
          source.oauth?.providerId === 'atproto'
        ) {
          const profile = source.oauth.profile as AtprotoProfile | undefined;
          return profile?.did === ownerDid
            ? undefined
            : {
                error: 'not_owner',
                errorDescription: `This workspace belongs to ${ownerHandle}.`,
              };
        }
        if (source.method === 'email-otp' && source.action === 'create-user')
          return user.email && (await deps.admits(user.email))
            ? undefined
            : { error: 'no_invoices' };
        return { error: 'closed' };
      },
    },
    plugins: [
      atproto({ clientName: 'Hadronomy Invoices', keys: deps.atprotoKeys }),
      emailOTP({
        expiresIn: codeLifetime,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }, ctx) {
          if (type !== 'sign-in' || !ctx) return;
          // A code goes only where it can open something: a customer who
          // already has an account, or an inbox that may open one. The
          // owner's address is a placeholder no mail reaches.
          const known =
            await ctx.context.internalAdapter.findUserByEmail(email);
          if (
            known
              ? 'did' in known.user && known.user.did
              : !(await deps.admits(email))
          )
            return;
          const accept = ctx.request?.headers.get('accept-language') ?? '';
          await deps.sendCode({
            to: email,
            code: otp,
            language: accept.toLowerCase().startsWith('es') ? 'es' : 'en',
          });
        },
      }),
      // Last, so it copies every cookie the plugins above set.
      tanstackStartCookies(),
    ],
  }) satisfies BetterAuthOptions;

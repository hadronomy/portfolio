import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcp } from '@better-auth/mcp';
import { type AtprotoProfile, atproto } from '@portfolio/auth-atproto';
import { baseLocale } from '@portfolio/i18n';
import { extractLocaleFromRequest } from '@portfolio/i18n/runtime';
import type { Language } from '@portfolio/invoices/model';
import { OwnerDid } from '@portfolio/invoices/model';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { codeLifetime } from '../../server/mail.server';
import {
  agentIssuer,
  agentResource,
  agentScope,
  authBasePath,
  ownerHandle,
} from './shared';

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
  /** The public origin agents reach the workspace at; see `agentResource`. */
  readonly origin: string;
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
      // Agents reach the workspace over MCP as OAuth clients of this same
      // sign-in: the owner signs in as always, approves the agent once, and
      // the agent holds a token bound to the MCP endpoint alone.
      jwt({ jwt: { issuer: agentIssuer(deps.origin) } }),
      // The provider's endpoint metadata types an optional OpenAPI field as
      // `undefined`, which this app's exactOptionalPropertyTypes rejects;
      // the plugin itself is what better-auth expects.
      mcp({
        loginPage: '/invoices/connect',
        consentPage: '/invoices/connect/consent',
        resource: agentResource(deps.origin),
        scopes: ['openid', 'offline_access', agentScope],
        // The sign-in page names the agent before the owner is signed in;
        // the signed request it carries still decides what it may see.
        allowPublicClientPrelogin: true,
      }) as BetterAuthPlugin,
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
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
          // The page that asked spoke the visitor's language and kept it
          // in a cookie; the code arrives in the same one.
          await deps.sendCode({
            to: email,
            code: otp,
            language: ctx.request
              ? extractLocaleFromRequest(ctx.request)
              : baseLocale,
          });
        },
      }),
      // Last, so it copies every cookie the plugins above set.
      tanstackStartCookies(),
    ],
  }) satisfies BetterAuthOptions;

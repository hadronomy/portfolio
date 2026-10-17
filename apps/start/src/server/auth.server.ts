import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { createMcpProtectedRequestHandler } from '@better-auth/mcp';
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { Postgres } from '@portfolio/database';
import {
  CustomerAccess,
  type CustomerEmail,
  customerEmail,
} from '@portfolio/invoices/customer-access';
import type { OwnerDid } from '@portfolio/invoices/model';
import { betterAuth } from 'better-auth';
import { and, desc, eq } from 'drizzle-orm';
import { Context, Effect, Layer, Redacted } from 'effect';
import { authOptions, ownerDid } from '~/features/auth/options';
import { withOfflineAccess } from '~/features/auth/refresh';
import {
  agentIssuer,
  agentResource,
  agentScope,
  authNamespace,
} from '~/features/auth/shared';
import * as tables from '~/features/auth/tables';
import { clientAddressHeader } from '~/server/client-address.server';
import { AppConfig } from '~/server/config.server';
import { reportedError } from '~/server/errors.server';
import { Mailer } from '~/server/mail.server';
import { agentOrigin, fixedOrigin } from '~/server/origin.server';
import { CurrentRequest, Refused } from '~/server/request.server';
import { AppSecret } from '~/server/secret.server';

// Sign-in, as a service: better-auth underneath, Effects on top. better-auth
// awaits promises, so the services it calls back into (who may open an
// account, how a code is mailed) run on the context this layer was built in.

export { ownerDid };

/** Who is signed in, as the interface needs to know it. */
export type Viewer =
  | { readonly _tag: 'Owner'; readonly handle: string }
  | { readonly _tag: 'Customer'; readonly email: CustomerEmail };

export interface AuthApi {
  /** Answers one request to better-auth's own endpoints, under /invoices/auth. */
  readonly handle: (request: Request) => Effect.Effect<Response>;
  /** Who the session in these headers belongs to, or null for nobody the app knows. */
  readonly viewer: (headers: Headers) => Effect.Effect<Viewer | null>;
  /**
   * Answers an agent's request to the MCP endpoint with `serve`, once its
   * bearer token checks out: signed here, bound to this endpoint, granted
   * the invoices scope, and approved by the owner. Anything else gets the
   * challenge that starts the client's sign-in.
   */
  readonly agent: (
    request: Request,
    serve: (request: Request) => Promise<Response>,
  ) => Effect.Effect<Response>;
  /**
   * Answers the discovery documents agents read before they sign in, at
   * their well-known paths outside /invoices/auth; null for any other path.
   */
  readonly discovery: (request: Request) => Effect.Effect<Response | null>;
  /** The agents the owner has let in, newest first. */
  readonly agents: () => Effect.Effect<readonly ConnectedAgent[]>;
  /**
   * Shuts an agent out at once: its approval and refresh tokens go, and
   * the access token it holds stops working on its next request.
   */
  readonly disconnect: (clientId: string) => Effect.Effect<void>;
}

/** An agent the owner approved, as Settings lists it. */
export interface ConnectedAgent {
  readonly clientId: string;
  readonly name: string | null;
  readonly site: string | null;
  readonly icon: string | null;
  readonly connectedAt: string | null;
}

/** Sessions for the owner and for customers. */
export class Auth extends Context.Service<Auth, AuthApi>()('Auth') {}

export const authLayer = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    const secret = yield* AppSecret;
    const postgres = yield* Postgres.Postgres;
    const run = Effect.runPromiseWith(
      yield* Effect.context<CustomerAccess | Mailer>(),
    );
    const origin = yield* Effect.try(() =>
      fixedOrigin({
        configured: settings.origin,
        production: settings.production,
      }),
    ).pipe(Effect.orDie);
    const agents = agentOrigin({
      configured: settings.origin,
      production: settings.production,
    });
    // The promise flavour of the database the invoice services use.
    const authDb = postgres.promise(tables.authRelations);
    const auth = betterAuth({
      ...authOptions({
        origin: agents,
        admits: (email) =>
          run(
            CustomerAccess.use((access) => access.admits(customerEmail(email))),
          ),
        sendCode: (message) =>
          run(
            Mailer.use((mailer) =>
              mailer.signInCode({
                ...message,
                accountUrl: `${origin}/invoices/account`,
              }),
            ),
          ),
        atprotoKeys: settings.atprotoKeys,
      }),
      // Development runs on whichever loopback port the dev server took, so
      // the base URL comes from the request there, behind the dev proxy.
      baseURL: origin ?? {
        allowedHosts: ['127.0.0.1:*', 'localhost:*', '[::1]:*'],
        protocol: 'http',
      },
      secret: Redacted.value(secret),
      database: drizzleAdapter(authDb, {
        provider: 'pg',
        schema: tables,
        schemaName: authNamespace,
        // User and account are created together, or not at all.
        transaction: true,
      }),
      ...(settings.production && {
        logger: {
          level: 'error' as const,
          // Auth driver messages can include query values and email addresses.
          log: (_level: string, _message: string, ...causes: unknown[]) => {
            reportedError(causes);
          },
        },
      }),
      advanced: {
        trustedProxyHeaders: !origin,
        ipAddress: { ipAddressHeaders: [clientAddressHeader] },
      },
    });
    const ownerId = async () => {
      const [owner] = await authDb
        .select({ id: tables.user.id })
        .from(tables.user)
        .where(eq(tables.user.did, ownerDid));
      return owner?.id ?? null;
    };
    // A token is the owner's while the owner still approves the client that
    // holds it. Checking the approval on every request is what makes a
    // disconnect immediate, though the token itself would live on.
    const admitted = async (
      subject: unknown,
      client: unknown,
    ): Promise<'owner' | 'disconnected' | 'stranger'> => {
      if (typeof subject !== 'string' || typeof client !== 'string')
        return 'stranger';
      if (subject !== (await ownerId())) return 'stranger';
      const [consent] = await authDb
        .select({ id: tables.oauthConsent.id })
        .from(tables.oauthConsent)
        .where(
          and(
            eq(tables.oauthConsent.userId, subject),
            eq(tables.oauthConsent.clientId, client),
          ),
        );
      return consent ? 'owner' : 'disconnected';
    };
    const issuer = agentIssuer(agents);
    const resource = agentResource(agents);
    const guard = (serve: (request: Request) => Promise<Response>) =>
      createMcpProtectedRequestHandler(
        {
          issuer,
          audience: resource,
          jwksUrl: `${issuer}/jwks`,
          requiredScopes: [agentScope],
        },
        async (request, claims) => {
          switch (await admitted(claims.sub, claims.azp ?? claims.client_id)) {
            case 'owner':
              return serve(request);
            // A token the owner withdrew: the challenge tells the client
            // to sign in again rather than give up.
            case 'disconnected':
              return new Response(null, {
                status: 401,
                headers: {
                  'WWW-Authenticate': `Bearer error="invalid_token", error_description="The owner disconnected this agent.", resource_metadata="${new URL(resource).origin}/.well-known/oauth-protected-resource${new URL(resource).pathname}"`,
                },
              });
            // Customers can sign in too; only the owner's grant reaches data.
            case 'stranger':
              return new Response(
                'Only the workspace owner can connect an agent.',
                { status: 403 },
              );
          }
        },
      );
    // The provider's endpoints are missing from auth.api's type, because its
    // plugin is widened in authOptions; these two are there at run time.
    const provider = { api: auth.api } as unknown as Parameters<
      typeof oauthProviderAuthServerMetadata
    >[0] &
      Parameters<typeof oauthProviderOpenIdConfigMetadata>[0];
    const authorizationServer = oauthProviderAuthServerMetadata(provider);
    const openIdConfiguration = oauthProviderOpenIdConfigMetadata(provider);
    const resourcePath = new URL(resource).pathname;
    const issuerPath = new URL(issuer).pathname;
    const authorizePath = `${issuerPath}/oauth2/authorize`;
    return Auth.of({
      handle: (request) =>
        Effect.promise(() =>
          auth.handler(withOfflineAccess(request, authorizePath, resource)),
        ),
      agent: (request, serve) => Effect.promise(() => guard(serve)(request)),
      discovery: (request) =>
        Effect.promise(async () => {
          const path = new URL(request.url).pathname;
          // RFC 8414 and RFC 9728 put an issuer's or resource's own path
          // after the well-known name; plain names serve clients that skip it.
          if (
            path === `/.well-known/oauth-authorization-server${issuerPath}` ||
            path === '/.well-known/oauth-authorization-server'
          )
            return authorizationServer(request);
          if (
            path === `/.well-known/openid-configuration${issuerPath}` ||
            path === `${issuerPath}/.well-known/openid-configuration` ||
            path === '/.well-known/openid-configuration'
          )
            return openIdConfiguration(request);
          if (
            path === `/.well-known/oauth-protected-resource${resourcePath}` ||
            path === '/.well-known/oauth-protected-resource'
          )
            return auth.handler(request);
          return null;
        }),
      agents: () =>
        Effect.promise(async () => {
          const owner = await ownerId();
          if (!owner) return [];
          const rows = await authDb
            .select({
              clientId: tables.oauthConsent.clientId,
              name: tables.oauthClient.name,
              uri: tables.oauthClient.uri,
              icon: tables.oauthClient.icon,
              connectedAt: tables.oauthConsent.createdAt,
            })
            .from(tables.oauthConsent)
            .innerJoin(
              tables.oauthClient,
              eq(tables.oauthClient.clientId, tables.oauthConsent.clientId),
            )
            .where(eq(tables.oauthConsent.userId, owner))
            .orderBy(desc(tables.oauthConsent.createdAt));
          return rows.map((row) => ({
            clientId: row.clientId,
            name: row.name,
            site: siteOf(row.uri ?? row.clientId),
            icon: row.icon,
            connectedAt: row.connectedAt?.toISOString() ?? null,
          }));
        }),
      disconnect: (clientId) =>
        Effect.promise(async () => {
          const owner = await ownerId();
          if (!owner) return;
          await authDb.transaction(async (tx) => {
            for (const table of [
              tables.oauthConsent,
              tables.oauthRefreshToken,
              tables.oauthAccessToken,
            ])
              await tx
                .delete(table)
                .where(
                  and(eq(table.userId, owner), eq(table.clientId, clientId)),
                );
          });
        }),
      viewer: Effect.fn('Auth.viewer')(function* (headers) {
        const session = yield* Effect.promise(() =>
          auth.api.getSession({ headers }),
        );
        if (!session) return null;
        const { user } = session;
        if (user.did === ownerDid)
          return { _tag: 'Owner', handle: user.name } as const;
        if (!user.did && user.emailVerified)
          return {
            _tag: 'Customer',
            email: customerEmail(user.email),
          } as const;
        return null;
      }),
    });
  }),
);

/** The host an agent's address names, for the owner to recognise it by. */
const siteOf = (address: string) => {
  try {
    return new URL(address).host;
  } catch {
    return null;
  }
};

/** Who signed this request in, or null. */
export const viewer = Effect.gen(function* () {
  const auth = yield* Auth;
  const request = yield* CurrentRequest;
  return yield* auth.viewer(request.headers);
});

/** The owner's DID; anyone else is refused before any invoice data loads. */
export const requireOwner = Effect.gen(function* () {
  if ((yield* viewer)?._tag !== 'Owner')
    return yield* new Refused({
      status: 401,
      message: 'Sign in to access invoices.',
    });
  return ownerDid as OwnerDid;
});

/** The signed-in customer's address; anyone else is refused. */
export const requireCustomer = Effect.gen(function* () {
  const current = yield* viewer;
  if (current?._tag !== 'Customer')
    return yield* new Refused({
      status: 401,
      message: 'Sign in to see your invoices.',
    });
  return current.email;
});

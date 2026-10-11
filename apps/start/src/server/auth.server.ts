import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { Postgres } from '@portfolio/database';
import {
  CustomerAccess,
  type CustomerEmail,
  customerEmail,
} from '@portfolio/invoices/customer-access';
import type { OwnerDid } from '@portfolio/invoices/model';
import { betterAuth } from 'better-auth';
import { Context, Effect, Layer, Redacted } from 'effect';
import { authOptions, ownerDid } from '../features/auth/options';
import { authNamespace } from '../features/auth/shared';
import * as tables from '../features/auth/tables';
import { AppConfig } from './config.server';
import { Mailer } from './mail.server';
import { fixedOrigin } from './origin.server';
import { CurrentRequest, Refused } from './request.server';
import { AppSecret } from './secret.server';

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
    const auth = betterAuth({
      ...authOptions({
        admits: (email) =>
          run(
            CustomerAccess.use((access) => access.admits(customerEmail(email))),
          ),
        sendCode: (message) =>
          run(Mailer.use((mailer) => mailer.signInCode(message))),
        atprotoKeys: settings.atprotoKeys,
      }),
      // Development runs on whichever loopback port the dev server took, so
      // the base URL comes from the request there, behind the dev proxy.
      baseURL: origin ?? {
        allowedHosts: ['127.0.0.1:*', 'localhost:*', '[::1]:*'],
        protocol: 'http',
      },
      secret: Redacted.value(secret),
      // The promise flavour of the database the invoice services use.
      database: drizzleAdapter(postgres.promise(tables.authRelations), {
        provider: 'pg',
        schema: tables,
        schemaName: authNamespace,
        // User and account are created together, or not at all.
        transaction: true,
      }),
      advanced: { trustedProxyHeaders: !origin },
    });
    return Auth.of({
      handle: (request) => Effect.promise(() => auth.handler(request)),
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

# better-auth for invoice sign-in

Checked on 4 October 2026 against better-auth 1.7.7, the `latest` tag on npm (published 30 September 2026), its shipped types and source, and its documentation.

## What 1.7 gives this app

- **One admission gate.** `user.validateUserInfo` runs before every user creation, account link, and OAuth sign-in, for every method. It fails closed: a throw rejects. The app keeps its whole policy there: the owner's DID for AT Protocol, an open payment link for a new customer, and a refusal for anything else. [Better Auth 1.7](https://better-auth.com/blog/1-7)
- **Dynamic base URL.** `baseURL: { allowedHosts, protocol }` resolves the origin per request, behind `advanced.trustedProxyHeaders`. Development uses it, because the dev server's loopback port varies; production sets a fixed HTTPS origin.
- **Schema checked at start.** 1.7 compares the Drizzle schema with its options when it initializes, in production too. `apps/start/src/features/auth/tables.ts` is what `auth generate` writes from `auth.config.ts`, which builds from the same `authOptions` the server runs; drizzle-kit turns it into migrations.
- **Drizzle 1.0 and Relations v2.** `@better-auth/drizzle-adapter/relations-v2` needs `drizzle-orm >=1.0.0-rc.1`, so Drizzle's `beta` tag (1.0.0-beta.22) does not qualify; the RC line does. With `schemaName` the CLI writes the tables into their own PostgreSQL schema and exports `defineRelationsPart` relations. The adapter's `transaction` option is off by default; it is on here, so a user and its account are created together.
- **Email OTP.** `emailOTP` signs in and creates verified users in one step, stores codes hashed when asked, rate-limits sends, and answers the same way whether or not it sent a code.
- **TanStack Start.** A catch-all route hands requests to `auth.handler`; `tanstackStartCookies()`, last in the plugin list, copies cookies set during server-function calls. [TanStack Start integration](https://www.better-auth.com/docs/integrations/tanstack)

## How a plugin is built

Read from the built-in plugins (`siwe`, `email-otp`, the OAuth callback) rather than the docs alone. [Plugins](https://www.better-auth.com/docs/concepts/plugins)

- Endpoints come from `createAuthEndpoint`. Sign-in paths sit under `/sign-in/<method>`, so the client exposes `signIn.<method>`. Endpoints a browser should not call, such as callbacks and metadata, take `metadata: { scope: 'server' }` (`HIDE_METADATA`): routed over HTTP, absent from the client.
- Redirect targets in a request body pass through `originCheck`, which holds them to the trusted origins.
- `handleOAuthUserInfo` from `better-auth/oauth2` is the shared provider path: find by `(providerId, accountId)`, create user and account in one transaction, run the admission gate, and create the session. A plugin that reuses it inherits account linking and 1.7's identity rules.
- Fields a plugin adds to `user` take `input: false` when the app authorizes on them; otherwise a user could set them through `update-user`.
- Error codes come from `defineErrorCodes` and reach the client as `error.code`. State cookies use `createAuthCookie` with `setSignedCookie`, as the OAuth state does.
- The client half is `$InferServerPlugin` plus `$ERROR_CODES`; the endpoint types flow from the server plugin.

## AT Protocol specifics

The official `@atproto/oauth-client-node` 0.5.9 does the protocol: handle and DID resolution, PAR, PKCE, DPoP, and `iss` checks. Its state and session stores live in better-auth's verification table, encrypted with the auth secret, so a callback can land on any server instance. Loopback clients must redirect to `127.0.0.1` or `[::1]`, never `localhost`. Confidential web clients sign token requests with `private_key_jwt` and publish their public keys. [AT Protocol OAuth](https://atproto.com/specs/oauth)

## API design borrowed from Effect v4 and opencode v2

- **The consumer line first.** `authClient.signIn.atproto({ handle })` reads like the built-in `signIn.social`. The plugin takes one options object: a client name and keys.
- **Narrow capability.** The plugin proves identity and keeps nothing; who may enter is the app's call, in the one gate better-auth already has. `CustomerAccess` in `packages/invoices` is one service with three verbs (`admits`, `invoices`, `invoice`), keyed by a branded `CustomerEmail`.
- **Failures as data.** Plugin failures are named codes; callback failures are documented `?error=` values the sign-in screen maps to words.
- **Fail early.** A fixed HTTPS deployment without a signing key fails when the server starts, not at the first sign-in.

## Drizzle 1.0 RC with Effect 4.0

Drizzle 1.0 RC ships Effect drivers (`drizzle-orm/effect-postgres`, `drizzle-orm/effect-pglite`) over `@effect/sql-pg` and `@effect/sql-pglite`. The `rc5` build (1.0.0-rc.5-5935859) is the first that runs on Effect 4.0.0 final: `rc.4` calls `Schema.TaggedErrorClass`, which 4.0.0 removed. Its type declarations still import `effect/unstable/sql/SqlError`, a path 4.0.0 moved to `effect/sql`; nothing imports it at run time, and the error types still resolve as tagged `SqlError`. Recheck both when Drizzle publishes the next release.

# TanStack Start inside Astro

Research date: 8 September 2026.

## Decision

Keep Astro as the public server. Build Start separately, then import its Fetch handler into an Astro catch-all endpoint.

This preserves Start SSR, server functions, server routes, and client navigation. Astro keeps its pages, React islands, content pipeline, and deployment adapter.

The two applications have separate Vite builds. Each framework owns its compiler plugins and generated modules. The production output runs in one Node process or Vercel function.

## Evidence

Start documents a `fetch(Request)` server entry. It handles SSR, server routes, and server functions through that entry. This is the supported boundary used here. [Start server entry](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point).

Astro integrations can inject routes and inspect resolved routes. The integration exports `patternRegex` values for every Astro route, including prerendered routes. It does not export source paths or server code. [Astro Integration API](https://docs.astro.build/en/reference/integrations-reference/#astroroutesresolved).

Astro gives static routes priority over dynamic routes. The injected catch-all handles remaining requests. The exported patterns also protect dynamic routes with no generated page. [Astro routing](https://docs.astro.build/en/guides/routing/#route-priority-order).

The `astro-tanstack` project combines Astro with TanStack Router and Query. It does not provide the full Start server runtime required here. [Project source](https://github.com/phuoccss/astro-tanstack).

Astro 7 also offers a Fetch entry. Its runtime route selection alone cannot represent ownership of every prerendered pattern. This implementation uses the resolved route patterns explicitly. The injected endpoint also gives direct access to Astro's custom 404 rewrite. [Astro Fetch API](https://docs.astro.build/en/reference/modules/astro-fetch/).

Local notes in `~/brain` contained Start starter projects and stack comparisons. They contained no tested Astro/Start composition that met these ownership rules.

## Ownership contract

For each request, check the complete pathname first:

1. A matching Astro pattern owns the request.
2. Otherwise, a matching Start route owns the request.
3. Otherwise, repeat these checks for each parent pathname, nearest first.
4. If no parent matches, Astro owns the 404.

An Astro catch-all owns its whole pattern, including its 404s. An Astro page at `/store` does not reserve `/store/cart`.

| Astro routes       | Start routes  | Request                    | Owner                    |
| ------------------ | ------------- | -------------------------- | ------------------------ |
| `/store`           | `/store`      | `/store`                   | Astro                    |
| `/store`           | `/store/cart` | `/store/cart`              | Start                    |
| `/store`           | `/store/cart` | `/store/missing`           | Astro 404                |
| `/store`           | `/store/cart` | `/store/cart/missing`      | Start 404                |
| `/store/cart/help` | `/store/cart` | `/store/cart/help/missing` | Astro 404                |
| `/blog/[...slug]`  | `/blog/tool`  | `/blog/tool`               | Astro, including its 404 |
| none               | none          | `/missing`                 | Astro 404                |

Only declared Start routes count. Its root layout and fuzzy matches do not reserve unrelated URLs. Tests use TanStack's real matcher for dynamic, index, and splat routes.

## Request flow

In development, Astro starts a private Start Vite server on an available loopback port. Astro forwards Start requests and proxies Start assets and HMR. The public URL stays on Astro's origin.

In production, Astro builds Start first and bundles its handler. Start assets live under `/_apps/`. Server functions use `/_apps/functions/`. Application routes retain their normal paths.

The Start handler returns an internal marker when Astro owns a request. The Astro endpoint consumes that marker and rewrites to `/404` with status 404. The marker never reaches the visitor.

Start's root `beforeLoad` repeats the ownership check for client navigation. A destination owned by Astro causes a full document navigation. Astro links into Start use `data-astro-reload`.

## Astro 7 upgrade

The project uses Astro 7.3.1 with matching official integrations. Node 22.12 or newer is required. Content configuration now lives in `src/content.config.ts`, with Zod imported from `astro/zod`. [Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/).

The Markdown configuration explicitly uses `unified()` from `@astrojs/markdown-remark`. This supports the existing Fumadocs, Twoslash, math, and emoji plugins. Astro 7 uses the Rust compiler and JSX whitespace rules. [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/).

## Maintenance boundary

This is a local integration assembled from documented framework APIs. It is not an official combined framework preset.

After a framework upgrade, run the ownership tests, both production builds, and browser checks for hydration, server functions, and navigation across frameworks. Keep the TanStack route generator and runtime versions aligned through the lockfile.

The integration targets Node and Vercel. Other adapters need their own build and runtime checks. Static-only hosting cannot run Start server functions.

## Verification

- 30 ownership tests cover the shared resolver and a real TanStack route tree.
- 12 HTTP tests cover production SSR, framework 404s, asset delivery, and HEAD requests.
- Six development tests cover route changes, HMR transport, automatic port selection, concurrent builds, and React islands.
- Browser checks cover hydration, the SHA-256 server function, and document navigation back to Astro.
- React and CSS hot reload preserve input state. Syntax errors show an overlay and recover after correction.
- Development starts with both generated route files absent. The typography draft renders its Markdown plugins under Astro 7.
- Temporary routes verify Astro/Start collisions, protected blog patterns, an Astro child below Start, and Start client navigation.
- Both Node and Vercel production builds complete locally.

These checks do not publish or test a remote Vercel deployment.

## Development regression

The repository patches `@tanstack/router-generator@1.167.34`. Its cached child nodes retained a deleted parent when no replacement parent existed. The patch clears that parent reference. Bun applies it during installation.

The dev-server test adds and removes a parent around an existing child route. It fails on the published package and passes with the patch. The test also requests the generated client module, so it covers both server and client route processing.

Source: [TanStack route generator](https://github.com/TanStack/router/blob/main/packages/router-generator/src/generator.ts).

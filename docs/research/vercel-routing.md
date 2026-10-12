# Vercel routing

Verified on 12 October 2026 with Astro 7.3.1, `@astrojs/vercel` 11.0.10, and `@vercel/routing-utils` 6.5.0.

## Redirects

Astro uses `trailingSlash: 'ignore'` and the official Vercel adapter.
Vercel's global `trailingSlash` field stays unset to avoid redirects on invoice endpoints.
[Astro configuration](https://docs.astro.build/en/reference/configuration-reference/#trailingslash),
[Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json#trailingslash),
[adapter documentation](https://docs.astro.build/en/guides/integrations-guide/vercel/),
[adapter source](https://github.com/withastro/astro/blob/main/packages/integrations/vercel/src/index.ts).

`apps/astro/vercel.json` adds one 308 slash redirect with a named path parameter and a negative lookahead.
It excludes `/invoices`, `/_apps`, and `/.well-known` at a segment boundary.
The last segment must contain no dot and must end without `/`.
The root, slashed paths, and file paths bypass this rule.
AT Protocol client metadata responds directly at its canonical apex URL.
[Redirect configuration](https://vercel.com/docs/routing/redirects/configuration-redirects),
[AT Protocol OAuth](https://atproto.com/specs/oauth#client-id-metadata-document).

The `www` host redirects every path to `https://hadronomy.com` before other redirects.
Invoice cookies, OAuth, MCP, and customer links use that fixed origin.
The `/:path*` rule uses a host condition.
Vercel compiles it strictly, so a companion `/:path(.*/|)` rule covers the root and slashed paths.
Both rules preserve the path for every request method.
The gallery redirect sends `/work/stacks/` to `/#work`.
[Routing utility source](https://github.com/vercel/vercel/blob/main/packages/routing-utils/src/superstatic.ts).

## Build and deployment evidence

`VERCEL=1 bun run build` emits `.vercel/output/config.json` without project redirects.
Its first route is `handle: filesystem`. The dynamic catch-all sends requests to `_render`.

Vercel merges the redirects during its deployment build.
Its build runner calls `getTransformedRoutes(localConfig)`, then `mergeRoutes` with project and builder routes.
It writes the combined routes to the final deployment configuration.
[Build runner source](https://github.com/vercel/vercel/blob/main/internals/cli-builder-integration/src/do-build.ts#L545),
[route merge](https://github.com/vercel/vercel/blob/main/internals/cli-builder-integration/src/do-build.ts#L2082),
[final configuration](https://github.com/vercel/vercel/blob/main/internals/cli-builder-integration/src/do-build.ts#L2163).

`tests/vercel-routing.test.mjs` uses `getTransformedRoutes` without a build.
It verifies GET and POST for slash redirects, unchanged apex paths, and `www` redirects, including protected URLs.
A local `mergeRoutes` assertion placed all four project redirects before the generated filesystem phase.
[High-level routing](https://vercel.com/docs/build-output-api/features#high-level-routing),
[Build Output routes](https://vercel.com/docs/build-output-api/configuration#routes).

The generated output was deleted after verification. No hosted deployment was part of this verification.

## Region

`regions: ["fra1"]` selects Frankfurt for functions. Hobby permits one chosen function region.
The local function manifest declares `nodejs24.x` without a region. Vercel applies the project region during deployment.
Static files remain on the global CDN. [Function regions](https://vercel.com/docs/functions/configuring-functions/region),
[region list](https://vercel.com/docs/regions).

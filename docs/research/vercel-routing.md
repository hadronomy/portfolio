# Vercel routing

Verified on 12 October 2026 with Astro 7.3.1 and `@astrojs/vercel` 11.0.10.

## Slash normalization

Vercel's `trailingSlash: true` sends a 308 redirect for extensionless paths
without a final slash. Omitting the field disables that global redirect.
[Project configuration](https://vercel.com/docs/project-configuration/vercel-json#trailingslash).

Astro's `trailingSlash` also controls on-demand requests. `always` redirects
GET requests with 301 and other methods with 308. `ignore` accepts either form.
[Astro configuration](https://docs.astro.build/en/reference/configuration-reference/#trailingslash).

The installed adapter maps Astro's `always` to Vercel's `true` in
`dist/index.js:369`. It calls `getTransformedRoutes`, then writes those rules to
`.vercel/output/config.json`. Its read of `vercel.json` only detects conflicting
slash settings. Omitting Vercel's field alone therefore leaves the adapter's
redirect active. [Adapter documentation](https://docs.astro.build/en/guides/integrations-guide/vercel/),
[adapter source](https://github.com/withastro/astro/blob/main/packages/integrations/vercel/src/index.ts).

This site uses Astro's `ignore` and omits Vercel's field.
`integrations/vercel.mjs` retains the official adapter, then prepends exact
308 redirects for prerendered portfolio pages. It excludes file endpoints,
`/invoices`, `/_apps`, and `/.well-known`. New prerendered pages receive the
same rule without another route list.

Build Output API routes use pathname regular expressions. Routes without a
`methods` field apply to every request method. The filesystem phase serves
static assets before the dynamic catch-all.
[Build Output configuration](https://vercel.com/docs/build-output-api/configuration#routes).

`vercel.json` keeps the old gallery redirect and the `www` host redirect.
The host redirect excludes the three protected prefixes too. Vercel's own
routing utility accepts that source pattern and produces no matching redirect
for the protected paths.
[High-level routing](https://vercel.com/docs/build-output-api/features#high-level-routing).

AT Protocol requires a direct response for its client metadata document.
[OAuth specification](https://atproto.com/specs/oauth#client-id-metadata-document).

## Region

`apps/astro/vercel.json` sets `regions: ["fra1"]`. Hobby permits one chosen
function region. The adapter has no region option, so the project field sets
the deployment region. Static files remain on the global CDN.
[Function regions](https://vercel.com/docs/functions/configuring-functions/region),
[region list](https://vercel.com/docs/regions).

The local function manifest declares `nodejs24.x`. It does not declare a region
because Vercel applies the project field during deployment. No hosted deploy
was part of this verification.

## Generated evidence

`VERCEL=1 bun run build`, from `apps/astro`, emitted six exact slash redirects:
`/blog`, `/experiments`, `/work/canary`, `/work/inari`, `/work/ram`, and
`/work/vrpt-swts`. Each points to the same path with a final slash.

The next rule is `handle: filesystem`. The dynamic catch-all is
`src: "^(?:/(.*?))?/?$", dest: "_render"`, without a forced status.

Assertions covered GET, HEAD, POST, and OPTIONS for ten protected URLs:
`/invoices`, `/invoices/`, `/invoices/mcp`, `/invoices/auth/token`,
`/invoices/auth/oauth2/token`, `/invoices/auth/atproto/callback`,
`/invoices/auth/atproto/client-metadata.json`, `/_apps/functions/example`,
`/.well-known/oauth-authorization-server/invoices/auth`, and
`/.well-known/oauth-protected-resource/invoices/mcp`.
All 40 cases bypassed redirects and reached `_render`.

The generated output was removed after verification. Repeat the build to
inspect the actual artifact. The focused route tests also cover canonical
portfolio URLs, file endpoints, and the protected prefixes.

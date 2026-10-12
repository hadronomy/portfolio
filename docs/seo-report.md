# SEO implementation report

Reviewed on 2026-10-11 for `https://hadronomy.com`.

This report records the SEO implementation and checks before Git publication. The Cloudflare hostname redirect is live. At the final build, the app changes were local and ready to deploy. This report does not establish a production app deployment, Search Console submission, or Bing submission.

The target audience is technical teams and customers across the EU. The target work is web development, product development, full-stack engineering, and product engineering. The HTML content remains English.

The [research report](seo-research.md) contains the source review and detailed recommendations. This report records the implementation, its checks, and the remaining release work.

## Result

| Area | Result |
| --- | --- |
| Identity | The homepage names Pablo Hernández and full-stack/product engineering. The visible introduction names Spain and availability across Europe. |
| Search appearance | Each indexable page has its own title, description, canonical URL, image metadata, and structured data. |
| Project discovery | Four static project pages now contain technical notes, images, source links, and breadcrumbs. |
| Articles | Published articles receive a visible author, dates, a responsive hero image, and matching `BlogPosting` data. |
| Index control | Draft articles stay out of production. The empty writing index and 404 page have `noindex`. |
| Sitemap | The generated sitemap contains exactly the five canonical, indexable HTML URLs. Article update dates come from real content dates. |
| AI search | Existing crawl access remains open. The existing training policy remains unchanged. |
| Hostname | Cloudflare redirects HTTP and HTTPS requests from `www` to the HTTPS apex with HTTP 301. |
| Build protection | `bun run build` now includes an audit of generated SEO output. |

These changes make the content easier to discover and understand. They do not establish a ranking, a Google rich result, or an AI citation. Google selects results through its own systems. [Google structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Framework and technology decisions

The site keeps Astro 5.16.6 and static output. Searchable content reaches the browser as HTML. The existing React gallery still provides the visual interaction. Search discovery does not require a canvas event or React hydration.

The implementation uses the installed `@astrojs/sitemap` integration. A small wrapper reads final HTML to exclude `noindex` pages and extract article dates. This avoids a separate list of indexable routes. The build audit detects differences between the HTML and sitemap. [Astro sitemap integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/).

Astro assets provide article image dimensions and responsive image output. The installed `takumi-js` package generates the homepage social image at build time. `sharp`, already installed, checks emitted image dimensions. The task added no package dependency or framework upgrade.

The tools for the next measurement stage are Google Search Console, Rich Results Test, PageSpeed Insights, and Bing Webmaster Tools. An additional SEO package is unnecessary for this static site. The shared metadata component and output audit already cover the current routes.

## Metadata and identity

The homepage title is:

> Pablo Hernández | Full-Stack & Product Engineer

Its description is:

> Full-stack and product engineer in the Canary Islands, Spain. Web development, product interfaces, APIs, and AI systems for teams across Europe.

The visible introduction supports these subjects. It describes web applications, product interfaces, backend systems, and agentic AI. It states availability for projects across Europe. It does not claim previous customers in every EU country.

The shared metadata component emits:

- One absolute canonical URL on `https://hadronomy.com`.
- Canonical paths with trailing slashes for HTML pages, without tracking parameters or fragments.
- A title, description, robots directive, and Open Graph site name.
- Absolute Open Graph and Twitter image URLs, dimensions, and descriptive image alt text.
- Correct Twitter `name` attributes and the existing creator account.
- A 1200 × 630 PNG social image for the homepage and general pages.
- A 96 × 96 PNG favicon for search appearance, alongside the existing ICO and Apple icon.
- JSON-LD with escaped HTML delimiters.

The normal robots directive permits full snippets and large image previews. The site does not add `meta keywords`. Google can choose a different title or snippet from the visible content. [Title links](https://developers.google.com/search/docs/appearance/title-link), [snippet controls](https://developers.google.com/search/docs/appearance/snippet).

The contact section now includes a visible email link. It works on touch devices and without the keyboard shortcut. The existing shortcut and social profiles remain available.

The implementation also removes the shared image handler that made images transparent before their load event. Image content now remains visible by default.

## Structured data and page inventory

| Canonical path | Structured data | Purpose |
| --- | --- | --- |
| `/` | `WebSite`, `ProfilePage`, `Person` | Describe the site name and the person who owns the portfolio. |
| `/work/canary/` | `BreadcrumbList`, `WebPage`, `CreativeWork`, `Person` | Describe the legal retrieval project and its creator. |
| `/work/inari/` | `BreadcrumbList`, `WebPage`, `CreativeWork`, `Person` | Describe the device infrastructure project and its creator. |
| `/work/ram/` | `BreadcrumbList`, `WebPage`, `CreativeWork`, `Person` | Describe the language and emulator project and its creator. |
| `/work/vrpt-swts/` | `BreadcrumbList`, `WebPage`, `CreativeWork`, `Person` | Describe the routing solver and its creator. |
| `/blog/`, after publication | `CollectionPage`, `BreadcrumbList` | Describe the writing collection. The current empty index has no JSON-LD and uses `noindex`. |
| Published `/blog/<id>/` | `BlogPosting`, `BreadcrumbList`, `Person` | Describe an article, its author, and its actual dates. |

The `Person` uses the actual profile name, role, avatar, and owned GitHub, X, and LinkedIn profiles. Stable entity IDs connect references across pages. The homepage uses `ProfilePage` because its main subject is one person. [ProfilePage guidance](https://developers.google.com/search/docs/appearance/structured-data/profile-page).

The `WebSite` data provides a site-name preference. Google chooses the displayed site name. The implementation does not add the obsolete sitelinks search box. [Site-name guidance](https://developers.google.com/search/docs/appearance/site-names).

Project pages have a visible `Home / Project` breadcrumb. There is no invented `/work/` index page in the hierarchy. Generic `WebPage` and `CreativeWork` types provide Schema.org context. They have no dedicated Google rich-result promise. [Schema.org WebPage](https://schema.org/WebPage), [Schema.org CreativeWork](https://schema.org/CreativeWork), [Google Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

Articles use the visible title, author, publication date, and optional update date. They do not use the build date as an update date. The hero image uses the content image dimensions and alt text. [Article guidance](https://developers.google.com/search/docs/appearance/structured-data/article).

The implementation adds no ratings, reviews, awards, customer counts, FAQ rich-result data, or local-business claims. There is no service address or factual basis for those additions.

## Project content and internal links

The gallery now links to the project pages. Each project page links to its source repository or product documentation. The gallery also retains a readable list for browsers without JavaScript.

The project notes describe technical decisions and constraints:

- Canary: Spanish legal documents, temporal validity, hierarchical retrieval, and its Rust/TypeScript implementation.
- Inari: local device APIs, interrupted connectivity, managed fleets, and its alpha status.
- RAM: the machine model, instruction execution, CLI, and language documentation.
- VRPT-SWTS: two connected vehicle fleets, constraints, search algorithms, and solution inspection.

The notes derive from the projects' own documentation: [Canary](https://github.com/hadronomy/canary), [Inari](https://github.com/hadronomy/inari), [RAM](https://ram.hadronomy.com), and [VRPT-SWTS](https://github.com/hadronomy/VRPT-SWTS). They contain no invented performance results or customer outcomes.

These pages provide technical context. They still need the owner's first-hand evidence to become detailed case studies. Useful additions include the author's exact role, measured results, implementation screenshots, and lessons from real operation.

The duplicate `/work/stacks/` source route is removed. The Vercel configuration redirects that old URL to the work section on the homepage.

## URLs, sitemap, and hosting

Astro uses `trailingSlash: 'always'`. Internal article and project links follow that policy. The generated canonical and sitemap URLs agree.

The sitemap includes only `/` and the four project URLs. The empty writing index and 404 page are excluded. Draft article routes do not exist in the production output. A published article makes the writing index indexable automatically.

The sitemap uses real article dates for `lastmod`. It does not mark every page as updated on every build. It adds no artificial `priority` or `changefreq` values. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

`apps/astro/vercel.json` configures trailing-slash redirects, the obsolete work URL, and a hostname redirect. It must be loaded from the deployed Vercel project root. The current live response includes Vercel headers, but the dashboard root setting was not available through a connected deployment tool. The release must use `apps/astro` as the app root. [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).

### Live Cloudflare change

The initial `www` response was Cloudflare 526. A new Dynamic URL Redirect now handles that hostname before an origin request. The operation left DNS, TLS mode, and crawler policy unchanged. The unused `www` origin certificate was not repaired.

The rule was created at `2026-10-11T07:22:17Z`:

- Ruleset: `68cee5dda9384bcea3f50afbb3f5c8e5`.
- Rule: `936c4687cf034f9896351f1e16e671ce`.
- Match: `http.host eq "www.hadronomy.com"`.
- Destination: HTTPS apex plus the original path.
- Response: HTTP 301, with the original query string.

The exact body is stored in [cloudflare-www-redirect.json](seo/cloudflare-www-redirect.json). This uses Cloudflare's documented [Single Redirect API](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/).

| Request | Observed result |
| --- | --- |
| `https://www.hadronomy.com/` | 301 to `https://hadronomy.com/`, then 200. |
| `https://www.hadronomy.com/blog/?utm_source=seo-check` | 301 to the apex with the same path and query. |
| `http://www.hadronomy.com/work/ram/?ref=seo-check` | 301 directly to HTTPS apex with the same path and query. |

The redirect is live. New project pages, new metadata, and the new sitemap require the app deployment.

## AI search and training policy

The existing robots file permits all crawlers and names the sitemap index. The inspected Cloudflare bot configuration did not enable AI search, training, or user-bot blocking. This task preserved those values.

The resulting policy keeps Googlebot, Bingbot, OAI-SearchBot, and Claude-SearchBot crawl access open. Robots and HTTP access do not guarantee that a particular service will index or cite the site. The checks did not perform requests from verified crawler IP ranges.

Search access and training access are separate. OpenAI distinguishes OAI-SearchBot from GPTBot. Anthropic distinguishes Claude-SearchBot from ClaudeBot. Google-Extended does not control ordinary Google Search indexing. [OpenAI bots](https://developers.openai.com/api/docs/bots), [Anthropic crawlers](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).

Google's current Search generative AI control also affects eligibility for its AI search features. The property account needs inclusion enabled. This task did not access or change that account control. [Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en).

No `llms.txt` file was added. Google's current guidance states that Search ignores these files. For this site, useful HTML and accurate entity data provide the supported implementation path. [Google generative AI guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

IndexNow remains optional future work for participating search engines, including Bing. This task did not install a key or submit URLs. A deployment hook that submits actual changed URLs is the appropriate addition for frequent updates. It is not a Google indexing API. [Bing IndexNow](https://www.bing.com/indexnow/IndexNowView/IndexNowGetStartedView).

## Checks and evidence

The final command ran from `apps/astro` at `2026-10-11T07:29:50.515Z`:

```sh
bun run build
```

The script runs `astro check`, `astro build`, and `node scripts/seo/check.mjs`.

```text
Result (79 files):
- 0 errors
- 0 warnings
- 0 hints

SEO check passed: 7 HTML pages, 5 indexable URLs, matching sitemap, valid JSON-LD, and reachable local links/images.
```

The generated-output audit checks canonical origins and paths, unique metadata, heading count, JSON syntax, entity types, article dates, image files/dimensions, internal links, robots, and sitemap equality. It is a repository check. It does not replace Google's live eligibility tests.

A temporary published article also passed a production build. The check covered the author, publication/update dates, hero image, RSS entry, writing index, and sitemap `lastmod`. The fixture was removed. The final build contains no temporary article.

Browser checks covered the homepage and all four project pages at a 390-pixel viewport. No horizontal overflow or broken image appeared. Desktop inspection and the homepage-to-Canary navigation passed. The client navigation replaced the title, canonical URL, and JSON-LD graph correctly. A homepage URL with a tracking query retained the clean canonical URL. The empty writing index retained `noindex` and emitted no JSON-LD.

Source formatting and `git diff --check` passed. The 404 source uses `noindex`. Its actual deployed HTTP 404 status still needs a release check.

### Performance samples and limits

| Sample | TTFB | FCP | LCP | CLS | INP |
| --- | --- | --- | --- | --- | --- |
| Initial live homepage | 271.4 ms | 4396 ms | 5144 ms | 0 | No input sample |
| Later live homepage | 191.1 ms | 232 ms | 404 ms | 0 | No input sample |
| Fresh browser session, local build | 2.2 ms | 40 ms | 692 ms | 0 | No input sample |

These are unthrottled browser observations. Cache state and the network differ. They do not prove a speed improvement or a field performance score. The inspected image requests began early in the later samples. No performance trace tool was available in the active catalog.

The field targets are LCP at most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1. Assessment uses the 75th percentile across real visits, separately for mobile and desktop. [Web Vitals](https://web.dev/articles/vitals).

The release needs a PageSpeed Insights run and the Search Console Core Web Vitals report. A small portfolio can lack sufficient CrUX traffic. In that case, a controlled Lighthouse run provides lab evidence, but it does not establish field INP.

## Search strategy

| Search intent | Relevant page or next content | Priority |
| --- | --- | --- |
| Pablo Hernández, hadronomy | Homepage and consistent owned profiles | First |
| Full-stack engineer, product engineer, web development in Europe | Homepage with clear work, location, availability, and project evidence | First |
| Rust/TypeScript product engineering, local-first infrastructure | Inari notes plus first-hand implementation articles | Next |
| Legal retrieval, Spanish law RAG, temporal document retrieval | Canary notes plus a technical article with actual examples | Next |
| Random Access Machine language and emulator | RAM notes and the project documentation | Next |
| Waste routing, transfer stations, GRASP/GVNS | VRPT-SWTS notes and measured comparisons from its own solver | Next |

These are intent groups, not keyword-volume or rank predictions. Broad service queries have substantial competition. Project-specific topics give this portfolio more direct evidence than generic keyword repetition.

English HTML supports the current EU technical audience. There is no separate page for every country. Spanish PDF output does not create an HTML language pair, so the task added no HTML `hreflang` cluster. Future translations need complete equivalent pages and reciprocal language links. [Google multilingual guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

The next content priority is first-hand evidence. A useful article explains a real decision, shows a reproducible example, and links to the actual work. Generic summaries and mass-produced query pages add little value. [Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

Owned project READMEs and profiles can link to the relevant portfolio pages. These links help users connect the source work to its author. Purchased links or invented endorsements have no place in this plan.

## Release checklist

1. Deploy the app changes through the existing production release workflow.
2. Use `apps/astro` as the Vercel project root.
3. Request every sitemap URL and confirm HTTP 200 with the expected metadata.
4. Request an unknown URL and confirm HTTP 404.
5. Confirm that slash redirects and the obsolete work redirect use permanent responses.
6. Confirm that deployment previews have protection or `X-Robots-Tag: noindex` from the host.
7. Verify the `hadronomy.com` domain property in Google Search Console.
8. Submit `https://hadronomy.com/sitemap-index.xml` to Search Console.
9. Inspect the homepage and four project URLs with URL Inspection.
10. Run the homepage and project breadcrumbs through Rich Results Test.
11. Keep Search generative AI inclusion enabled for the property.
12. Verify the site and submit the sitemap in Bing Webmaster Tools.
13. Run PageSpeed Insights for the production homepage and one project page.

Search Console and Bing account actions remain open because their connected account tools were not available. The task contains no claim that either engine indexed the new pages.

## Measurement and maintenance

After deployment, record the release date and indexing state. Compare branded and non-branded queries separately. Review impressions, clicks, landing pages, countries, and the query groups in this report. Use a 28-day window and extend it if traffic is low.

Review the Google generative AI report where available. Track AI referral traffic separately from Google search traffic. Browser referral data cannot count every citation or answer impression.

Measure relevant contact requests as the business outcome. Ranking for unrelated high-volume searches is not the objective. A simple count of qualified email inquiries can serve this purpose without a new analytics dependency.

Each published article needs a specific description, a real publication date, a representative hero image, and useful alt text. Add `updatedDate` only after a material update. Keep one H1 in the layout and use H2/H3 headings in the article body. Run `bun run build` before each release.

Project records live in `src/lib/work-projects.ts`. Project notes live in `src/lib/project-details.ts`. Update both when the work changes. The [gallery guide](work-gallery.md) describes their relationship.

The remaining ranking work is sustained publication, stronger first-hand project evidence, relevant references to the work, and measurement. The technical configuration provides the base for that work.

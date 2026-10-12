# SEO research for hadronomy.com

**Checked:** 2026-10-11

**Site type:** Personal portfolio for a software engineer

**Framework:** Astro 5.16.6, static output, `@astrojs/sitemap`

**Primary goal:** Make the site easy to crawl, understand, cite, and show in Google Search, Google AI Overviews and AI Mode, Bing/Copilot, ChatGPT Search, and Claude Search.

**Audience and market:** Technical teams and customers in any EU country who need web development, product development, full-stack engineering, or product engineering. This audience comes from the current task brief. It does not require a local-business schema or a separate page for every EU country.

This report uses three labels:

- **Source fact** means a current statement from a first-party documentation source or an observation from this repository.
- **Recommendation** means an implementation choice based on those facts and the site audit.
- **Unresolved** means that the public first-party sources did not answer the question, or that the decision needs the site owner.

SEO can improve discovery and understanding. It cannot force a crawl, an index entry, a ranking, a rich result, a citation, or a related-search placement. Google states that structured data gives eligibility and does not guarantee a rich result. Search systems use many signals, and a result can change with query, location, language, device, competition, and time.

## Implementation priorities from the research

The implementation report records which recommendations are complete: [SEO implementation report](seo-report.md). The priorities describe the research decisions.

The following order gives the portfolio the strongest return for the least complexity.

1. **Give the home page a precise entity title and description.** Use a title such as `Pablo Hernández — Product Engineer` only if it matches the visible page. Make the first heading and opening text state the person, role, core areas, and location in natural language. Replace the current generic defaults.
2. **Add truthful JSON-LD to the home page.** Use `WebSite` with the canonical home URL and the visible site name. Use `ProfilePage` with a `Person` as `mainEntity` because the home page is focused on one person. Keep `name`, `description`, `image`, `sameAs`, and contact details equal to facts visible on the page. Do not add a generic `Person` block and expect a Person rich result: Google’s supported gallery uses `ProfilePage` for a personal profile.
3. **Make each published article complete.** Add an author byline, publication date, and an optional updated date only when the page has a real update value. Add `BlogPosting` JSON-LD with the same visible values. Add a visible `Home > Writing > Article` breadcrumb and matching `BreadcrumbList` JSON-LD when the route has that hierarchy.
4. **Keep URL signals consistent.** Choose the deployed trailing-slash policy, configure Astro to match it, emit one canonical URL per page, and include only those canonical URLs in the sitemap. Add `hreflang` only when equivalent HTML pages exist in each language. The current site has English HTML and Spanish PDF output, so it does not have an HTML language cluster to annotate.
5. **Keep crawl access simple.** Keep `Googlebot`, `Bingbot`, `OAI-SearchBot`, and `Claude-SearchBot` allowed if the goal includes those search systems. Check the hosting firewall and CDN as well as `robots.txt`; a robots rule cannot help when a network layer blocks the crawler. Keep the sitemap URL in `robots.txt` and submit it to Search Console and Bing Webmaster Tools.
6. **Keep important content in the static HTML.** Astro’s static output is a good fit. Project names, descriptions, headings, links, article text, and author data must be present in HTML that a crawler can render without a client event. Use real links and semantic headings. Do not put important text only on a canvas or behind a client-only interaction.
7. **Measure the result.** Verify the home page, blog index, every published article, and any new project pages in URL Inspection and the Rich Results Test. Watch indexing, queries, impressions, clicks, Core Web Vitals, and the Google Search Console Generative AI performance report. Review Bing Webmaster Tools after each material release.
8. **Build topical depth with first-hand pages.** Give each important project a stable internal page with a problem, the author’s role, technical decisions, constraints, results, links, and images. Link to those pages from the home page and relevant writing. This gives search systems more useful evidence than a gallery with only external links.

## Repository baseline

The audit read the current source and package manifests. The lockfile and installed package resolve Astro to `5.16.6`. A fresh validation run completed from `apps/astro` at `2026-10-11T07:20:28Z` with `bun run build` (the script runs `astro check && astro build`). `astro check` reported 0 errors, warnings, or hints across 78 files. `astro build` produced 7 HTML pages plus the PDF, RSS, robots, favicon, and social-image endpoints. It generated four project pages: `/work/canary/`, `/work/inari/`, `/work/ram/`, and `/work/vrpt-swts/`. The empty blog index is emitted but carries `noindex`; it is absent from the generated sitemap. The generated sitemap contains the home page and the four project pages. The previous `dist` files are no longer used as evidence.

The current source tree contains the home page, an empty blog index and draft route, four project routes, `robots.txt`, RSS, CV endpoints, favicon, and a social-image endpoint. The obsolete `/work/stacks/` route is absent from the fresh build.

The current implementation has these relevant properties:

| Area | Observed state | SEO consequence |
| --- | --- | --- |
| Site identity | `astro.config.mjs` sets `site: 'https://hadronomy.com'`. | Astro can generate absolute sitemap and canonical URLs. Keep the deployed host equal to this value. |
| Sitemap | `@astrojs/sitemap` is enabled. The fresh build emitted `sitemap-index.xml` and `sitemap-0.xml`; the child sitemap contains `/` and the four project pages. | Submit the index URL and keep only canonical, indexable HTML URLs in it. |
| Robots | `/robots.txt` allows `User-agent: *` and points to `https://hadronomy.com/sitemap-index.xml`. | Search and AI crawlers are currently allowed by this file. Hosting or CDN rules can still block them. |
| Metadata | The shared component emits canonical, description, robots, Open Graph, Twitter, image dimensions/alt, and JSON-LD. | The app uses one metadata contract across the generated pages. |
| Home page | The layout defaults now name Pablo Hernández and full-stack/product engineering. The visible introduction names Spain and availability across Europe. | Identity and audience signals match the visible profile. |
| Language | `Layout.astro` hard-codes `html lang="en"`. | Keep this for English HTML, or derive it from the actual route when localized HTML pages are added. Do not label an English page as Spanish. |
| Profile facts | `profile.ts` contains Pablo Hernández, Product/Full-Stack Engineer, Canary Islands, skills, email, avatar, and X/GitHub/LinkedIn URLs. | These can support `Person` and `ProfilePage` only where the same facts remain visible and accurate. Use `sameAs` for profiles the owner controls. |
| Blog | The collection has a `typography` draft and no published post. The empty index has `noindex`. Published posts use an author byline, dates, and matching `BlogPosting` data. | Drafts stay out of production, RSS, and the sitemap. The empty index becomes indexable with the first published post. |
| Work | The gallery links to four internal project pages. Each page contains technical notes and a source/product link. | Project names and technical subjects now have stable, crawlable URLs. |
| Structured data | The homepage uses `WebSite`, `ProfilePage`, and `Person`. Project pages use `WebPage`, `CreativeWork`, and `BreadcrumbList`. | These types describe the visible content. Generic project types do not promise Google rich results. |
| Build | Fresh `bun run build` passed at `2026-10-11T07:20:28Z`; `astro check` reported 0 errors, warnings, or hints, and Astro built 7 HTML pages. | Retain static or server-rendered HTML for core copy and inspect the rendered result after every metadata or route change. |

## Canonical host repair

At the initial review time, `https://hadronomy.com/` returned HTTP 200 and `https://www.hadronomy.com/` returned Cloudflare HTTP 526. Cloudflare defines 526 as an origin certificate that it cannot validate when Full (strict) is active. A broken host can block crawlers, social preview fetches, and users even when the apex host works.

**Implemented:** A Cloudflare edge redirect now sends every `www.hadronomy.com` request to `https://hadronomy.com` with HTTP 301. It preserves the path and query string. The rule was created at `2026-10-11T07:22:17Z`. HTTP checks passed for HTTPS home, HTTPS with a query, and HTTP with a path/query. The redirect runs before an origin request, so the broken `www` origin no longer serves these requests. The operation did not change TLS mode, DNS, or the existing training policy. It does not claim a repair to the unused `www` origin certificate. See the [implementation report](seo-report.md) and the [Cloudflare rule](seo/cloudflare-www-redirect.json).

## Google Search, AI Overviews, and AI Mode

### Source facts

Google’s [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) page says that the normal SEO fundamentals remain relevant for AI Overviews and AI Mode. A page must be indexed and eligible to appear with a normal Search snippet. Google says there are no additional technical requirements and no special schema or AI file required. The page must allow crawling, contain useful text, use good page experience, and use structured data that matches the visible page. AI features can show links to supporting pages, so a clear page with an independent answer can be useful even when the query is composed of several related searches.

Google’s [generative AI content guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), updated 2026-07-10, describes AI search as an extension of Search quality systems. It recommends unique, non-commodity content, first-hand experience, clear organization, and useful images or video where they add information. It rejects tricks based on keyword variations, scaled low-value pages, or special “AI optimization” markup. Google also states that it does not use `llms.txt` for Search or AI features and does not need new machine-readable AI files.

Search Console now has a [Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en) for a verified property. It controls whether the site’s links and content can appear in AI Overviews, AI Mode, and generative AI features in Discover. Google’s current help page says the control rolled out worldwide on 2026-08-31 and that inclusion is the default for properties without an inherited parent setting. This account setting is separate from robots, structured data, and `Google-Extended`.

Google does not promise that a page will be crawled, indexed, selected in an AI answer, or cited. A page can meet the technical requirements and still not show for a query.

### Recommendations for this portfolio

- Use the home page as a clear person and work entity. State `Pablo Hernández`, `Product Engineer` or `Full-Stack Engineer`, the main technical areas, and `Canary Islands, Spain` in visible prose where those facts are accurate.
- Write project pages and articles for a real reader first. Explain what was built, why a choice was made, what was learned, and where the source or live result is. These details give an AI system evidence that a generic skills list cannot provide.
- Use headings that state the subject of each section. Link from the profile to project pages and from articles to the projects they discuss. Use descriptive link text such as `Read the RAM project notes`, not repeated `View more` links.
- Put important text in the server-generated HTML. A canvas render can support the visual design, but the project name, role, summary, and link must also exist as normal HTML.
- Use structured data to describe the page that exists. It can clarify a person, website, article, or breadcrumb. It cannot create content that the page does not show.
- Do not add an “AI answers” block, keyword list, query-variant pages, hidden text, or an AI-specific schema. These add noise and can create spam or trust problems.
- Keep the Search Console generative AI control set to inclusion when AI visibility is the goal. Review the Generative AI performance report in the property. It reports performance for AI Overviews and AI Mode and does not turn into a ranking guarantee.

## Structured data and rich-result eligibility

Google’s [general structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) say that structured data gives eligibility, not a guaranteed display. The data must describe visible, relevant, complete, current content. It must not mislead, impersonate another entity, or contain hidden facts. Image URLs must be crawlable and indexable. JSON-LD is the recommended format. A manual action can remove rich-result eligibility even though it does not remove ordinary ranking eligibility.

Use the [Search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) to limit implementation to types that Google supports. A type can be valid schema and still have no Google Search feature.

### `WebSite` for the home page

The [site-name documentation](https://developers.google.com/search/docs/appearance/site-names) says that `WebSite` structured data on the domain home page is Google’s most important preference signal for a site name. The page must be crawlable. `name` and the canonical `url` are required. Google supports one site name per domain or subdomain. `alternateName` is appropriate only for a real alternative name that appears in the site or other reliable sources.

**Recommendation:** Add one `WebSite` object to `/`. Set `name` to the visible portfolio name and `url` to `https://hadronomy.com/`. Do not add `SearchAction`; Google removed the sitelinks search box globally on 2024-11-21. The `WebSite` site-name markup remains useful.

### `ProfilePage` and `Person`

The [ProfilePage documentation](https://developers.google.com/search/docs/appearance/structured-data/profile-page) defines a profile page as a page whose primary focus is one person or organization affiliated with the site. Examples include an “About Me” page and an author page. A generic store home page does not qualify. `mainEntity` is required and must be a `Person` or `Organization`; a `Person` requires `name`. Google recommends applicable fields such as `alternateName`, `description`, `image`, and `sameAs`.

**Recommendation:** The portfolio home page can use `ProfilePage` if it remains primarily about Pablo Hernández. Use a nested `Person` as `mainEntity`. Keep the values equal to visible content. Use the controlled GitHub, X, and LinkedIn profile URLs in `sameAs` when they are active and represent the same person. Do not add employers, job titles, awards, or locations that the page does not support. Do not put `ProfilePage` on the blog index or on a project page.

`Person` by itself is not listed as a standalone Google rich-result feature. The value here is entity clarity inside a supported `ProfilePage`, plus consistent visible facts and links.

### Project detail pages: `WebPage` and `CreativeWork`

The [Schema.org `CreativeWork` vocabulary](https://schema.org/CreativeWork) includes software programs and other authored work. The [Schema.org `WebPage` vocabulary](https://schema.org/WebPage) states that every web page is implicitly a `WebPage` and supports explicit page properties such as `breadcrumb`, `mainEntity`, and `primaryImageOfPage`. These are vocabulary relationships, not Google rich-result promises; Google’s supported Search gallery does not list a generic `CreativeWork` or `WebPage` result.

**Recommendation:** For each of the four factual project pages, use a top-level `WebPage` with the page URL, visible name, description, language, primary image, and `mainEntity` set to a `CreativeWork`. Add the project’s real source repository or live URL as `sameAs` or a visible link when it is the same work. Add `author` or `creator` only when the page names the person or team. Use `dateCreated`, `dateModified`, `version`, and `keywords` only when the facts exist in the content model and page. Do not add Article dates to a project page just to create a result feature. Put the project name, role, technical choices, constraints, outcomes, and source links in normal HTML. Add a visible breadcrumb and matching `BreadcrumbList` when the route sits under `Work`.

### `BlogPosting` / `Article`

The [Article documentation](https://developers.google.com/search/docs/appearance/structured-data/article) supports `Article`, `NewsArticle`, and `BlogPosting`. There are no required Article properties, but Google recommends `author`, `author.name`, `author.url` or `sameAs`, `datePublished`, `dateModified` when applicable, `headline`, and `image`. The image must represent the article and be crawlable. Separate each author as a `Person`; put the person’s name in `author.name`, not a job title or publisher string.

**Recommendation:** Use `BlogPosting` on published blog post pages. Add a visible “By Pablo Hernández” byline if the JSON-LD names Pablo as author. Use the existing visible title, publication date, description, and hero image. Add `dateModified` only after the content model has a real value and the page displays or clearly documents the update. Keep drafts out of the production route, RSS, and sitemap. Do not add Article markup to the blog index, home page, or project pages unless the page is actually an article.

When the blog has no published posts, the index has little standalone search value. Use `noindex,follow` in the rendered page metadata and leave it out of the sitemap. Keep robots access open so Google can read the directive. Remove `noindex` when the index lists real published posts.

Google says Article markup can help it understand title, image, and date. It does not guarantee a rich result or an AI citation.

### `BreadcrumbList`

The [Breadcrumb documentation](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) describes a breadcrumb as the page’s position in a site hierarchy. Each `ListItem` needs a `position` and `name`; an `item` URL is used when appropriate. Google recommends testing the result and submitting a sitemap.

**Recommendation:** Add a visible breadcrumb to a post page, for example `Home > Writing > Article title`, and emit the same hierarchy as `BreadcrumbList`. Add it only when the hierarchy is real. Do not add a breadcrumb object to the home page or to a page that has no visible navigation path. The general structured data rules still apply: the JSON-LD must match what the user can see.

### Types to avoid for this site

- **FAQPage:** Google’s [Search updates](https://developers.google.com/search/updates) page records that FAQ rich results stopped showing on 2026-05-07. A visible FAQ can still help a reader, but adding FAQ JSON-LD for a generic portfolio has no expected Google rich-result value.
- **Sitelinks search box:** Google removed this feature globally on 2024-11-21. Keep `WebSite` site-name markup, and omit `potentialAction` for a search box.
- **Fake Organization, LocalBusiness, Review, JobPosting, or Event data:** Add these only when the page and the real entity meet the documented conditions. A personal portfolio does not need an Organization block just to appear more official.
- **Unsupported AI schema:** Google documents no special schema for AI Overviews or AI Mode.

## Crawl, index, canonical, and sitemap controls

### Technical requirements

Google’s [technical requirements](https://developers.google.com/search/docs/essentials/technical) are small: Googlebot must not be blocked, the page must return HTTP 200, and the page must have indexable content. These conditions do not guarantee indexing. The [Search process](https://developers.google.com/search/docs/fundamentals/how-search-works/) has crawl, index, and serve stages. A sitemap helps discovery, but Google still decides whether to crawl and index each URL.

The [Search Essentials](https://developers.google.com/search/docs/essentials) and [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) recommend clear titles, useful descriptions, descriptive headings and links, readable content, unique pages, and people-first writing. There is no preferred word count.

### `robots.txt` and `noindex`

Google’s [robots introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro) says that `robots.txt` controls crawling, not reliable removal from Search. A blocked URL can still appear as a bare URL. Use `noindex` when a crawler must see a page but the page must not enter the index; use authentication or removal when content must be private. A `noindex` directive cannot work if robots blocks the crawl.

The current `/robots.txt` allows all user agents and names the sitemap index. That is a good default for a public portfolio. Keep it unless a deliberate per-bot training policy is selected. Review CDN, WAF, rate-limit, and authentication rules separately.

### Canonical URLs

Google’s [canonicalization guide](https://developers.google.com/search/docs/crawling-indexing/canonicalization) calls a canonical a preferred representative URL, not an absolute command. Google combines redirects, `rel="canonical"`, sitemap URLs, HTTPS, and other signals. The [duplicate URL guide](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) ranks permanent redirects as the strongest consolidation signal, `rel="canonical"` as strong, and sitemap inclusion as weaker. Signals work best when they agree.

**Recommendation:**

- Use absolute self-canonicals generated from the deployed origin.
- Redirect alternate hosts and schemes to the chosen HTTPS host.
- Decide whether the site uses `/blog/` or `/blog` and apply the same choice to links, canonical tags, sitemap URLs, and server redirects. Astro’s [`trailingSlash` configuration](https://docs.astro.build/en/guides/configuring-astro/) must match the host behavior.
- Keep query parameters, preview routes, and duplicate paths out of the sitemap.
- Use `hreflang` only for equivalent localized HTML pages. Do not create an English/Spanish annotation pair for an English HTML page and a Spanish PDF.

### Sitemaps

The [sitemap build guide](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) says a sitemap is a hint. Use absolute URLs, include only canonical URLs that the owner wants in Search, and submit it through Search Console or list it in robots. One file can contain up to 50,000 URLs or 50 MB before compression. The fresh child sitemap contains only the home page and four project pages, which matches the current indexable HTML output.

**Recommendation:** Submit `https://hadronomy.com/sitemap-index.xml` to Google Search Console and Bing Webmaster Tools. Keep the robots reference. When internal project pages are added, let the Astro integration add them automatically and verify that draft pages and non-canonical routes stay out.

### Titles, snippets, and social previews

Google’s [snippet guidance](https://developers.google.com/search/docs/appearance/snippet) says that page content is the main source for a snippet; Google can use the meta description when it gives a better summary. Write a unique description for important pages and put the key subject in visible copy. Google’s [title-link guidance](https://developers.google.com/search/docs/appearance/title-link) says it can use the `<title>`, main heading, visible text, `og:title`, link text, and other sources, and it can rewrite a title.

**Recommendation:** Set an explicit title and description for every indexable HTML route. Keep the title concise, specific, and human-readable. Use one descriptive H1. Keep Open Graph and Twitter values aligned with the visible title and description. Give share images absolute, crawlable URLs and meaningful dimensions. The image itself must support the page topic.

## Crawler policy for Google, Bing, OpenAI, and Anthropic

Robots tokens control different products. A policy for Search does not automatically express a policy for training or user-directed retrieval.

| Token | First-party function | Recommendation for this public portfolio |
| --- | --- | --- |
| `Googlebot` | Google Search crawling and rendering. | Allow if Google Search visibility is a goal. |
| `Google-Extended` | Controls whether Google-crawled content can be used for future Gemini model training and grounding in Gemini Apps and Vertex AI. It has no effect on Google Search inclusion or ranking. See [Google’s common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers). | Choose separately from Search. Leaving it allowed supports broader Google AI use; disallowing it does not block Google Search. |
| `Bingbot` | Bing crawling, which supports Bing and Copilot search experiences. | Allow. Keep XML sitemap and semantic links available. |
| `OAI-SearchBot` | OpenAI search crawler used to surface sites in ChatGPT Search. Blocking it removes the site from ChatGPT Search answers, although navigational links can still appear. OpenAI says robots changes can take about 24 hours. See [OpenAI’s bot documentation](https://developers.openai.com/api/docs/bots). | Allow if ChatGPT Search visibility is a goal. Also allow the published OpenAI crawler IP ranges at the network layer. |
| `GPTBot` | OpenAI crawler for training and foundation-model improvement. | Make a separate owner decision. `Disallow` opts future crawled content out of that training use; it does not control `OAI-SearchBot`. |
| `ChatGPT-User` | User-initiated fetches from ChatGPT, not an automatic search crawl and not used to determine Search results. | Treat as a separate access policy. Do not assume its robots behavior equals `OAI-SearchBot`. |
| `Claude-SearchBot` | Anthropic crawler used to improve Claude search results. See [Anthropic’s crawler policy](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler). | Allow if Claude Search visibility is a goal. |
| `ClaudeBot` | Anthropic crawler for model training and development. | Make a separate owner decision. Blocking it does not block Claude Search. |
| `Claude-User` | User-directed retrieval in Claude. | Allow if user-directed retrieval is part of the visibility goal; decide separately from `Claude-SearchBot`. |

The current wildcard rule allows these agents in `robots.txt`. Do not add explicit `Disallow` rules for training bots without choosing the policy with the owner. If explicit rules are later added, keep separate blocks for search, training, and user fetch tokens. Verify the spelling and behavior against the current first-party documentation before deployment.

OpenAI’s help page also states that allowing `OAI-SearchBot` permits summaries and snippets but does not guarantee placement. Anthropic’s documentation states that all three of its bots respect robots rules and supports a non-standard `Crawl-delay`; the portfolio has no current need for a delay on a small static site.

**Network note:** A robots file is only one access layer. CDN bot management, WAF challenges, IP allowlists, TLS errors, rate limits, and authentication can stop a crawler after robots allows it. Keep public HTML and assets reachable with normal HTTP requests.

## Bing, Copilot, and IndexNow

Bing’s [Webmaster Guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a) describe the same base: crawlable links, XML sitemaps, useful original content, clear titles and headings, accurate structured data, and canonical URLs. The [IndexNow guide](https://www.bing.com/indexnow/IndexNowView/IndexNowGetStartedView) says that a site can submit added, updated, or deleted URLs with a host-matching key in the site root. It can submit one URL or a batch. IndexNow notifies participating engines, but it does not guarantee a crawl or an index entry.

**Recommendation:** IndexNow is optional for this low-churn portfolio. The sitemap and normal links are the first steps. Add IndexNow when the deployment can store a key in the domain root and send only changed URLs after a successful release. Do not send the full site on every build. Add the key and submission to the deployment process only after the key ownership and API response are observable.

Bing’s current help pages state that older URL submission APIs were scheduled for retirement on 2026-08-31. Use the current Bing Webmaster and IndexNow documentation rather than an old URL Submission API tutorial.

## `llms.txt` and machine-readable AI files

Google’s [generative AI guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) explicitly says that Google does not use `llms.txt` and that the file does not help or harm Google Search visibility. The OpenAI and Anthropic bot documents reviewed here explain robots tokens and crawler purposes; they do not document `llms.txt` as a ranking or retrieval requirement. Bing’s current webmaster guidance likewise points to normal crawl, sitemap, content, and structured-data practices.

**Recommendation:** Do not treat `llms.txt` as an SEO requirement or a substitute for HTML, sitemap, robots, or canonical signals. A small optional file can be added later if a particular AI service documents support or the owner wants a human-maintained index for agents. Until then, an experimental file has no verified Google benefit and no verified support from the other first-party bot guides reviewed here.

## Astro implementation guidance

Astro’s [configuration guide](https://docs.astro.build/en/guides/configuring-astro/) says the `site` option is used by integrations such as the sitemap and by URL generation. Common SEO metadata is still standard HTML in a layout. The [sitemap integration guide](https://docs.astro.build/en/guides/integrations-guide/sitemap/) says the integration needs a deployed `site`, emits `sitemap-index.xml` and a child sitemap, and can filter pages. Google ignores optional `changefreq` and `priority` values, so do not spend time tuning them.

Astro’s [image reference](https://docs.astro.build/en/reference/modules/astro-assets/) requires meaningful `alt` text for informative images and an empty `alt` for decorative images. Width and height help prevent layout shift. Use the image component or equivalent source metadata for hero and social images when it can emit stable dimensions.

The Astro-specific work list is:

1. Keep `site` as the canonical deployed origin and set `trailingSlash` to the host’s real redirect policy.
2. Extend the existing metadata component with route-specific title, description, canonical, language, Open Graph, and Twitter values.
3. Add JSON-LD from typed, page-level data. Do not put one generic Article or ProfilePage object into every layout.
4. Derive `html lang` from a real HTML locale. Keep English until localized HTML pages exist.
5. Keep all project summaries, article text, headings, author facts, and internal links in the initial HTML. Hydrated galleries can add interaction after that.
6. Add internal project routes if the owner wants project names or technologies to attract independent searches. Give each route a unique title, description, canonical, image, and visible content.
7. Keep drafts excluded from `getPosts()`, RSS, and the sitemap in production.
8. Run `astro check`, the static build, a rendered HTML inspection, the Rich Results Test, and URL Inspection after implementation.

## Practical authority and content plan

Google’s [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) recommends first-hand expertise, clear sourcing and background, a primary purpose, and useful original information. It says E-E-A-T is not a single ranking factor and that trust is the most important part. It warns against mass-produced pages made to capture queries, trend chasing without expertise, and content written only to attract Search traffic.

Apply that guidance to the portfolio as follows:

- **Home:** one clear identity and work proposition. State what Pablo builds, who the work helps, the main technologies, location, and a path to inspect the work.
- **Projects:** one stable page per meaningful project. Include the problem, role, scope, architecture, constraints, outcomes, links to source or live work, and images with accurate captions or alt text. Use concrete facts instead of a tool list.
- **Writing:** one topic and one reader need per article. Use a descriptive title, a useful first paragraph, headings, code or diagrams where they explain the work, author and date, and links to related project pages. Update an article when its content changes in a material way.
- **Internal links:** connect the home page, project pages, and articles with descriptive anchors. This helps people and crawlers understand the relationship between pages.
- **External authority:** link to the owner’s active GitHub, X, and LinkedIn profiles, and ask project repositories or real collaborators to link back when that link is useful. Do not buy links, exchange links at scale, or create invented mentions.
- **Language and region:** use `Canary Islands, Spain` only where it describes the person or work. Add Spanish HTML content only when there is a real Spanish reader need. Keep each language page complete instead of translating only metadata.
- **Related searches:** use the terms a real reader uses in titles, headings, visible prose, image alt text, and link text. Use Search Console query data to learn what people already ask. There is no reliable way to force a “related searches” placement.

Avoid keyword stuffing, hidden text, duplicate project pages, fake testimonials, invented client logos, generated pages with no first-hand evidence, and structured data for facts that are not visible. These tactics create a trust and quality risk and do not provide a durable path to Search or AI visibility.

## Performance and page experience

Google’s [Core Web Vitals documentation](https://developers.google.com/search/docs/appearance/core-web-vitals) gives these current targets:

| Metric | Target |
| --- | --- |
| Largest Contentful Paint (LCP) | 2.5 seconds or less |
| Interaction to Next Paint (INP) | less than 200 milliseconds |
| Cumulative Layout Shift (CLS) | less than 0.1 |

Use the Search Console Core Web Vitals report and field data such as CrUX to find real-user problems. These metrics are part of page experience, not a guarantee of ranking. The portfolio’s canvas work and client-side gallery make image dimensions, lazy loading, script cost, and input responsiveness worth measuring on a mid-range mobile device. Keep the text and navigation usable before the interactive gallery is ready.

## Measurement and release checks

Use this sequence after the SEO implementation and after each route release:

1. Build with `bun run build` and run the project’s type and Astro checks.
2. Inspect the emitted HTML for title, description, canonical, language, Open Graph, headings, links, and JSON-LD. Inspect the rendered HTML, not only a client-side view.
3. Run the home page and one article through Google’s [Rich Results Test](https://search.google.com/test/rich-results). Run the home page, article, and any profile route through [URL Inspection](https://support.google.com/webmasters/answer/12482179?hl=en) after the public deploy.
4. Submit `https://hadronomy.com/sitemap-index.xml` in Search Console. Test the sitemap, robots file, canonical, and HTTP status from an external network.
5. Review the Search Console indexing, performance, Core Web Vitals, and Generative AI performance reports. Google’s [Generative AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en) includes AI Overviews and AI Mode and, according to the current help page, rolled out worldwide by 2026-08-31. Google can omit the report when a property has no qualifying generative AI impressions.
6. Add the site to Bing Webmaster Tools, submit the sitemap, and review crawl errors. Add IndexNow only when its key and release hook are ready.
7. Test OpenAI and Anthropic visibility policies at the robots and CDN layers. A normal user-agent request must receive a 200 response for public HTML and assets.

Google’s [Rich Results Test help](https://support.google.com/webmasters/answer/7445569?hl=en) says that the test supports JSON-LD, RDFa, and Microdata and cannot guarantee that a result will appear. Its [Search Console reports](https://support.google.com/webmasters/answer/7552505?hl=en) are samples, not a complete list of all structured-data instances.

## Unresolved decisions and limits

- The production CDN, WAF, bot-management policy, and hosting logs were not part of the repository audit. Review them before launch.
- At the review time, the `www` host returned Cloudflare 526 while the apex returned 200. Cloudflare’s [Error 526 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/) and [Full (strict) SSL guidance](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) describe the origin-certificate requirements. Resolve this before crawl and indexing measurement.
- Search Console and Bing Webmaster ownership, sitemap submission, and baseline query data require access to the owner’s accounts.
- The owner must choose whether `GPTBot`, `ClaudeBot`, and `Google-Extended` may use public content for training or grounding. Search visibility and training permission are separate choices.
- The home page appears to be a person-centered profile and can qualify for `ProfilePage`, but the final markup must follow the visible page after the content change.
- No current first-party Perplexity crawler policy was found in the sources reviewed on 2026-10-11. Do not add a guessed `PerplexityBot` rule. Revisit if Perplexity visibility becomes a requirement and a first-party policy is available.
- `llms.txt` has no verified Google value and no documented support in the OpenAI, Anthropic, or Bing bot references reviewed here.
- Search position, AI citation, rich-result display, and related-search placement remain outside the site owner’s control. The implementation can improve eligibility and evidence, but it cannot promise a rank.

## Source register

All links below are first-party documentation or support pages. They were reviewed on 2026-10-11. Page update dates are included where the source exposed one; a page can change after this review.

### Google

- [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — AI Overviews and AI Mode use normal SEO eligibility; no extra schema or AI file.
- [Generative AI content guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) — people-first content, query fan-out context, no `llms.txt` use, no special AI markup; updated 2026-07-10.
- [Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en) — account-level inclusion for AI Overviews, AI Mode, and generative AI Discover features; worldwide rollout dated 2026-08-31.
- [Search updates](https://developers.google.com/search/updates) — FAQ rich result change from 2026-05-07 and current Search documentation changes.
- [Site names](https://developers.google.com/search/docs/appearance/site-names) — `WebSite` on the home page, one name per domain/subdomain.
- [ProfilePage structured data](https://developers.google.com/search/docs/appearance/structured-data/profile-page) — eligibility, `mainEntity`, Person fields, and profile conditions.
- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) — Article/BlogPosting fields, author, dates, and image guidance.
- [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) — hierarchy and `BreadcrumbList` fields.
- [General structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) — visibility, accuracy, completeness, eligibility, and JSON-LD guidance.
- [Structured data gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) — supported Google Search features.
- [Schema.org `CreativeWork`](https://schema.org/CreativeWork) — generic authored work vocabulary, including software programs.
- [Schema.org `WebPage`](https://schema.org/WebPage) — page vocabulary, `mainEntity`, and breadcrumb properties.
- [Technical requirements](https://developers.google.com/search/docs/essentials/technical) — Googlebot access, HTTP 200, indexable content.
- [How Search works](https://developers.google.com/search/docs/fundamentals/how-search-works) — crawling, indexing, serving, and sitemap discovery.
- [Search Essentials](https://developers.google.com/search/docs/essentials) — technical requirements, spam policies, and people-first best practices.
- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) — titles, links, descriptions, unique content, and no fixed word count.
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) — first-hand value, trust, and scaled-content risks.
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization) — canonical hints and signal consistency.
- [Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) — redirects, canonicals, and sitemap signal strength.
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) — absolute canonical URLs, submission, and limits.
- [Robots introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro) — crawl control versus index removal.
- [Google common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) — `Googlebot` and `Google-Extended` scope.
- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — rendering limits and server/static HTML guidance.
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) — LCP, INP, and CLS targets.
- [Snippet controls](https://developers.google.com/search/docs/appearance/snippet) — content and meta description sources.
- [Title links](https://developers.google.com/search/docs/appearance/title-link) — title, H1, visible text, and rewrite signals.

### Astro

- [Astro configuration](https://docs.astro.build/en/guides/configuring-astro/) — `site`, `trailingSlash`, and standard metadata.
- [Sitemap integration](https://v6.docs.astro.build/en/guides/integrations-guide/sitemap/) — site requirement, generated sitemap index, filter behavior, and ignored priority fields.
- [Astro assets](https://docs.astro.build/en/reference/modules/astro-assets/) — `alt`, dimensions, and image output.

### Bing, OpenAI, and Anthropic

- [Cloudflare Error 526](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/) and [Full (strict) SSL/TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) — valid origin certificate and hostname coverage required for a healthy proxied host.

- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a) — crawlability, original content, sitemaps, links, and accurate markup.
- [IndexNow getting started](https://www.bing.com/indexnow/IndexNowView/IndexNowGetStartedView) — key, host verification, changed URLs, and no indexing guarantee.
- [Bing sitemap guidance](https://www2.bing.com/webmasters/help/sitemaps-3b5cf6ed) — XML/RSS/Atom/text submission and robots reference.
- [OpenAI bot documentation](https://developers.openai.com/api/docs/bots) — `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`, and independent policies.
- [OpenAI ChatGPT Search help](https://help.openai.com/en/articles/9237897-chatgpt-search) — allow `OAI-SearchBot` and host/CDN access.
- [Anthropic crawler policy](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) — `ClaudeBot`, `Claude-User`, and `Claude-SearchBot`.

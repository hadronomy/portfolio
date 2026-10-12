# Invoicing application plan

This document defines the application to build and the order of delivery. It is a proposed design, not a completion report.

## Confirmed brief

- A private invoicing application under `/invoices`, inside the existing TanStack Start application.
- One owner, a server database, and AT Protocol sign-in restricted to the owner's DID.
- Customers can open an account from a valid payment link and see every invoice billed to them.
- Canary Islands invoicing with IGIC. Invoice language supports English and Spanish independently of tax treatment.
- Takumi generates every PDF. The integrated viewer displays those same PDF bytes.
- [Runey](https://runey.app) sets the composition and the document: a light workspace, a slim dark rail, the invoice page on a backdrop made from its own cover art, a floating inspector, and a dark dock for document controls. [Reference invoice](https://x.com/soltwagner/status/2103014380560691490).
- BoardUI, beautifului.dev, transitions.dev, and Craft set the quality bar for component states and motion. Do not install or copy their component libraries.
- DialKit informs compact controls and motion tuning. Torph owns changes to displayed interface text.
- The existing one-command Astro/Start development and build workflow remains the entry point.

The owner signs in as `hadronomy.com`. DNS and the DID document both resolve it to `did:plc:tvgjv46t4ebxbrvekr2vrnls`, checked on 9 September 2026. Configure authorization with that DID. Support ordinary IGIC, REPEP, and company profiles with effective dates. A database provider and deployment credentials are needed for hosted operation.

## Product experience

The invoice document is the main visual object. The page sits on a soft, grainy crop of its own cover art, so each invoice has its own atmosphere. The surrounding controls float over it and stay quiet.

The navigation rail contains a new-invoice button, invoices, customers, items, and issuer settings. On narrow screens it moves to the bottom edge. The invoice list uses aligned rows, search (`/`), status filters, and arrow-key movement between rows. A summary strip shows outstanding, overdue, and draft totals above the list.

Opening an invoice uses Start client navigation. The top bar holds navigation, save state, language, and the one primary action (issue, or record payment once issued). A dark dock under the page holds page, zoom, search, print, and download. The inspector groups customer, items, dates and numbering, payment and notes, issuer, and cover into collapsible sections; a closed section shows a one-line summary. On narrow screens, preview and edit are two views of one segmented control.

Line items use an editable table with keyboard movement, duplication, insertion, and reorder controls. Optional fields open in context. Adding a customer from the editor preserves the unfinished invoice.

Drafts save automatically. The interface distinguishes local edits, saving, saved, and failed saves. Failed saves retain the draft and offer retry. Concurrent edits produce a recoverable conflict instead of silently overwriting data.

Issuing an invoice is a separate action from saving or downloading a draft. The review view shows the exact invoice, totals, required fields, and number series. A completed issue operation opens the immutable invoice.

Payments have their own records. Partial payment, settled, and overdue displays come from payment allocations and due dates. Downloading a PDF never marks an invoice as sent or paid.

The PDF follows the Runey reference: an optional cover banner, an uppercase title with the number, three columns for issuer, customer, and dates, a ruled item table, a right-aligned totals block, then payment details and notes. The page itself stays white. The cover is a per-invoice choice (`none`, `ember`, `tide`, `moss`, `rose`) with a default in settings; `packages/invoices/scripts/covers.mjs` regenerates the art. Geist is the document face. The PDF renderer ignores `font-feature-settings`, so the shipped Geist files have their tabular figures made the default (`scripts/tabular-figures.py`). Names come from the issuer's saved data.

## Motion and controls

A shared set of tokens defines surface colors, focus, spacing, radii, easing, and duration across the invoicing application. This does not restyle unrelated portfolio pages.

BoardUI's task list provides a reference for compact progress rows, expandable detail, and completion states. Progress follows actual operations. Do not add artificial waiting, simulated steps, or hidden content that depends on animation completion. [BoardUI reference](https://www.boardui.com/components/task-list).

Use Motion for panel transitions, reordered rows, and interruptible state changes. Use CSS for simple color and opacity changes. Initial content remains visible. Keyboard focus, reduced motion, and touch targets are part of each control.

Use one application text component backed by `TextMorph` from `torph/react`. Apply it to changing totals, counts, labels, status, validation messages, page numbers, and translated interface text. Keep semantic text stable for assistive technology. [Torph](https://torph.lochie.me/).

Native input values must preserve selection, caret position, and IME composition. They cannot become animated DOM spans. Torph applies to their displayed labels and derived values. PDF text remains static document content.

DialKit informs grouped property rows, precise numeric entry, and segmented choices. Financial values always support explicit keyboard entry. Decorative sliders cannot replace exact money or tax inputs. Use DialKit only as an authoring tool if useful. [DialKit](https://www.dialkit.dev/).

## Library choices

| Concern                     | Proposed choice                                     | Reason                                                                             |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Routing and server boundary | Existing TanStack Start integration                 | Keeps client navigation, server functions, and one public origin                   |
| Form state                  | TanStack Form stable v1                             | Field subscriptions and typed nested line-item forms                               |
| Client collections          | TanStack DB with Query collections                  | Reactive customer, item, and invoice lists with optimistic draft changes           |
| Durable storage             | PostgreSQL with Drizzle 1.0 (RC) on Effect          | Typed query failures, Effect transactions, generated migrations                    |
| Local development storage   | PGlite through `@effect/sql-pglite`                 | Persistent local PostgreSQL without an additional database server                  |
| Domain schemas and services | Effect v4, pinned release candidate                 | Fits typed failures, server operations, and the requested Effect Craft conventions |
| Decimal arithmetic          | decimal.js                                          | Exact decimal operations with explicit rounding rules                              |
| Sign-in                     | better-auth with an authored AT Protocol plugin     | Sessions, rate limits, and email codes from one library; DID identity for the owner |
| PDF generation              | `takumi-pdf`                                        | Paged documents, embedded fonts, and selectable text                               |
| PDF viewer                  | EmbedPDF headless React                             | PDFium rendering with application-owned controls                                   |
| Accessible controls         | Existing Radix primitives, extended where necessary | Keeps keyboard and focus behavior on established primitives                        |
| Motion                      | Existing Motion plus Torph                          | Layout/state motion and consistent text changes                                    |

TanStack DB is the client data layer. PostgreSQL remains the authoritative database. Issuing invoices and allocating legal numbers never use optimistic client completion. [TanStack DB](https://tanstack.com/db/latest/docs/overview), [TanStack Form](https://tanstack.com/form/latest/docs/overview).

PGlite is the deliberate local database target. Production uses hosted PostgreSQL through the same schema. Production must fail clearly if database configuration is absent. Financial data cannot fall back to an ephemeral serverless filesystem. [Drizzle PGlite](https://orm.drizzle.team/docs/connect-pglite), [PGlite](https://pglite.dev/docs/).

### Database

`@portfolio/database` is the one place that knows where PostgreSQL lives. `Postgres.local` embeds PGlite (in memory for tests, in `.invoice-data/pglite` for development); `Postgres.hosted` connects to `DATABASE_URL`. Every module asks it for a Drizzle database typed by its own relations, through Drizzle's Effect driver, so queries are Effects with tagged failures and transactions roll back on any failure. better-auth, which awaits promises, gets the promise flavour of the same database.

Each module owns a PostgreSQL schema and its migration history: the invoice tables live in `invoices.*` (`packages/invoices/src/tables.ts`), the sign-in tables in `auth.*` (`apps/start/src/features/auth/tables.ts`, written by better-auth's CLI). Drizzle records applied migrations per module in `drizzle.invoices` and `drizzle.auth`.

| Change | Command |
| --- | --- |
| Invoice tables | Edit `tables.ts`, then `bun run --cwd packages/invoices db:generate` |
| better-auth plugins or options | `bun run --cwd apps/start auth:generate`, then `bun run --cwd apps/start db:generate` |
| Check that migrations match the schema | `bun run db:check` |
| Apply migrations to `DATABASE_URL` (deploy step) | `bun run db:migrate` |

A local database applies pending migrations when it opens. The SQL is inlined at build time, so a built server needs no migrations folder. A hosted database is never migrated by a running server: `db:migrate` runs before the deploy that needs it.

Package research on 9 September 2026 found Effect stable at 3.22.1 and its v4 candidate at 4.0.0-rc.112. The inspected opencode v2 branch uses that candidate. TanStack Form v2 is alpha, so select stable v1. Pin the chosen releases and check their shipped types before implementation.

Effect stays in schemas and server capabilities. Pure invoice arithmetic returns values. React components consume ordinary typed results. Do not build a second HTTP framework or copy opencode's Bun runtime assumptions. [opencode v2](https://github.com/sst/opencode/tree/v2).

## Invoice model

The domain separates reusable records from the immutable data printed on an issued invoice.

| Record        | Main data and invariants                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Issuer        | Legal name, tax ID, fiscal address, tax profile, payment details, logo, default language                             |
| Customer      | Legal identity, address, tax territory, business/consumer classification, preferred language                         |
| Catalog item  | Product or service description, unit, decimal price, default tax treatment                                           |
| Draft         | Editable lines, customer reference, dates, currency, terms, notes, revision                                          |
| Invoice       | Issuer/customer snapshots, issued number, issue date, supply dates, calculated amounts, policy and template versions |
| Line          | Stable ID, kind, description, quantity, unit, price, allowances/charges, tax treatment, supply period                |
| Tax treatment | Taxable, zero-rated, exempt with basis, outside scope with reason, or reverse charge with basis                      |
| Number series | Issuer, series, sequence, document category, and applicable numbering policy                                         |
| Payment       | Date, amount, currency, method, reference, allocations, and reversals                                                |
| Rectification | Original invoice references, reason, correction method, and adjustment amounts                                       |
| PDF artifact  | Exact bytes, invoice revision, language, template version, digest, and generation status                             |
| Audit entry   | Actor DID, operation, invoice reference, timestamp, and relevant revision                                            |

Supported commercial lines include goods, fixed services, hourly/daily services, expenses, shipping, and fees. Section headings and notes are non-financial rows. Discounts and charges are explicit adjustments. Advance payments, disbursements, and special tax treatments require distinct rules.

Currency, language, tax territory, and document kind are independent. English invoices keep the same tax identity and calculations as Spanish invoices. Translating an issued invoice creates another rendering of the same legal record, not another invoice number.

Amounts cross the wire as decimal strings. Quantities and unit prices retain their supported precision. A shared calculator applies the selected rounding policy, apportions document discounts by tax group, and returns a full breakdown. The server recalculates before issue.

Ordinary invoices, rectifying invoices, and proformas have distinct rules. Proformas never consume an ordinary invoice number. Unsupported special regimes produce an explicit block at issue time.

### Addresses

Every party holds one structured address: street lines, dependent locality, locality, region, postal code, sorting code, and an ISO 3166 country code. `packages/invoices/src/address-data.ts` is generated from Google's Address Data Service, the metadata behind libaddressinput and Chrome autofill, by `node packages/invoices/scripts/address-data.mjs`. It holds each country's field order, required fields, postal code pattern, field names, and first-level regions with their postal prefixes. The same data lays out the form, validates issuance, and prints the PDF. One local correction applies: Spain prints the province on its own line, as Correos asks.

Street search uses Photon, an OpenStreetMap geocoder, through an owner-only server function that decodes and caches its answers. `INVOICE_GEOCODER_URL` points it at a self-hosted Photon; the default is the public fair-use instance. Suggestions credit OpenStreetMap contributors, as the ODbL requires. Without the network, the form still lays out, validates, and derives the region from the postal code.

## Online payment through Stripe

An issued invoice can go to its customer as a payment link. Stripe Invoicing holds a copy of the invoice and the Payment Element takes the payment; the local invoice, its number, its calculation, and its PDF stay the record. [Research and sources](../research/stripe-headless-invoicing.md).

- **Projection** (`packages/invoices/src/stripe/projection.ts`): every line goes to Stripe as its taxable amount after discounts, with its IGIC passed as `tax_amounts`, so Stripe adds the calculator's numbers instead of computing its own. Withholding is a negative line; disbursements carry no tax. A draft whose subtotal, taxable base, tax, or total differs from the local invoice is never finalized.
- **Gateway** (`stripe/gateway.ts`): the only code that calls Stripe. It decodes each answer with Effect Schema, keeps the SDK's retries off, and retries transport, rate-limit, and Stripe-side faults three times with the same idempotency key. The API version is pinned to the installed SDK.
- **Collection** (`collection.ts`): shares, revokes, resolves links, serves the customer page, starts payments, and settles. Checkout and payment take an invoice ID; the caller authorizes first, by a link or by a signed-in customer the invoice is billed to. An invoice nobody shared opens for payment the first time its customer views it in their account. Each step is resumable from `invoice_collections`; settlement reads Stripe's invoice payments, so a webhook, the customer's return, or a repeat records each payment once.
- **Payments**: every payment is a PaymentIntent for the chosen amount, attached to the Stripe invoice before the browser confirms it, as Stripe's partial-payment guide describes. The Payment Element runs in deferred mode, so the amount can change before the intent exists. Starting a new attempt cancels any the customer abandoned, so two attempts can never both succeed. Every amount must be one the invoice's payment plan allows now; the server checks it again before it creates the intent.
- **Refunds**: a refund replaces the payment's ledger record with one for what was kept, reversing the original first. The invoice then shows the refunded amount outstanding again, and online payment stays off until the owner settles it.
- **Links**: 30 days, random 256-bit tokens, stored as SHA-256 hashes. The owner can close every open link at once. A link shows only that invoice and its PDF.
- **Customer page** (`features/invoices/pay.tsx`): the invoice and its remittance stub on one perforated ticket, in the invoice's language and cover. The same page serves a link (`/invoices/pay/$token`) and the account (`/invoices/account/$invoiceId`). The stub leads with what is due now, draws the plan, offers the payments the plan allows, and stamps the invoice when it is paid in front of the customer.
- **Account** (`features/account/account.tsx`): the next payment first, then the invoices to pay and the paid ones. Each row opens its invoice to pay it.

### Server runtime

The web app's server side is one Effect layer graph (`apps/start/src/server`): `AppConfig` from a single `Config` recipe, `AppSecret`, the database, the invoice services, `Auth` (better-auth, with its callbacks run on the graph's own services), `Mailer`, `Geocoder` (Effect `HttpClient` and `Cache`), and `Payments`, which is `None` without Stripe keys. Each server function and route hands one effect to `serve`, which supplies the request as `CurrentRequest` and turns a `Refused` failure into its HTTP status. Nothing below `serve` throws a `Response`.

### Payment plans

A plan says how the customer may pay one invoice (`packages/invoices/src/plan.ts`). It is rules, not amounts, so it stays true when a draft's total changes. A plan is a list of parts and two rules:

- **Parts**, in order. A part is one payment or a series of equal ones ("6 payments every month"). Each asks for a percentage, a fixed amount, or the rest; at most one part takes the rest, and it can sit anywhere, so a final holdback after the rest works. A payment falls due on issue, on the invoice's due date, on a date, or a stretch of days, weeks or months after issue or after the payment before it. Months keep the day, or end on a shorter month's last day. A series puts its odd cents on its last payment.
- **Rules**: whether the customer may pay ahead of the plan, and whether they may pay part of a payment, from a floor.

An invoice offers one to four plans (`invoices.offers`, one row per invoice). The customer picks one on their page; the first is the one the page opens on. The pick binds once a payment lands under it, and the owner can set it for them. An invoice with no row offers one payment in full.

`lay` turns a plan into payments for one invoice; `schedule` applies the payments it already has, earliest first; `options` lists what the customer may pay now: the next payment, everything already due, everything left when the plan allows it, or any amount in a range. Every amount reaches Stripe's minimum charge and leaves a chargeable remainder. A plan that cannot work as written (shares that do not add up, a payment under the minimum, dates out of order, more than 36 payments) is never offered; the studio names the fault.

**Library and defaults.** The owner keeps plans for reuse in one record (`plan-library`). A starred plan is a default, optionally only from a least total. A draft without plans of its own shows the defaults that suit its total; issuing it copies them onto the invoice, so later library changes never move what a customer was offered.

**The studio** (`features/invoices/plan-studio.tsx`). The inspector's "Payment plan" card lists the options; "Edit plans" grows the card into a full-screen studio with a view transition, each option's bar flying to its place. The studio has three columns:

- The rail: the options the customer chooses from (drag to reorder; the first opens first), "Add an option" from starting points or the library, and the library itself with a star per default.
- The composer: the option as sentences. Every value is a round pastel token, by what it holds (money, time, a count, a rule), with its words in ink. Each opens its own editor where it sits: a typed number and a slider for a share, a list of resolved dates for when, a stepper for how many. Rules toggle on a click. Words and amounts morph in place (torph). Above the sentences, a strip to scale, each part with its share and amount, over a fine ruler. Its seams sit exactly on the boundaries and drag money between neighbours.
- Limits: a share's slider and the strip's seams stop where the plan would break: what the other parts leave, less Stripe's minimum for each payment of the part that takes the rest. Past that point the slider is shaded and says "Up to 39%". A typed value past it is accepted and flagged. Fine diagonal lines mean "past a limit or not a number of its own": the part that takes the rest, a part that does not add up, a slider's shut end, and the calendar after the due date.
- The preview: what the customer sees, in their language. The calendar is a bklit composed chart (`apps/start/src/components/charts`, installed with the shadcn CLI from the `@bklit` registry): each payment a rounded bar on its date, over a quiet step of what has been paid by then, with the due date marked. Hovering a bar shows the day's payments and the share paid by then, and lights the part in the strip and its sentence.

Every change saves on its own. Price changes are deliberately out of scope: a discount for paying in full or a fee for instalments changes an issued factura's taxable base, which needs a rectifying invoice. Automatic charges on saved cards and reminders before each due date are the next layers; they need SetupIntents and the payments Worker's schedule.

Set two variables on the web app to switch it on; without them the feature stays hidden:

| Variable                 | Value                        |
| ------------------------ | ---------------------------- |
| `STRIPE_SECRET_KEY`      | A restricted or secret key   |
| `STRIPE_PUBLISHABLE_KEY` | The matching publishable key |

### Payments Worker

Stripe's webhook and the schedules run on a Cloudflare Worker, `apps/payments`, deployed with Alchemy and written in Effect. [Research and sources](../research/effect-alchemy-workers.md).

- **Webhook** (`src/webhook.ts`): `POST /stripe/webhook` verifies the delivery against its raw body with `StripeWebhooks` (Web Crypto, the signing secret only), reduces it to a `Settlement` (`packages/invoices/src/settlement.ts`), and queues it. Stripe hears 200 only once the queue holds the work; 400 for a bad signature, 503 when the queue refuses.
- **Queue** (`src/queue.ts`): a settlement runs `Collection.settle`, one per batch, with 10 retries a minute apart; what still fails waits in a dead-letter queue.
- **Reconciliation**: a Cron Trigger every 15 minutes queues `Collection.unsettled()`, every collection whose Stripe invoice can still change, so a lost webhook costs minutes.
- **Database** (`src/database.ts`): the same PostgreSQL through Hyperdrive, caching off, a connection per Worker event.
- **Stack** (`alchemy.run.ts`): the Worker, both queues, Hyperdrive, and the Stripe webhook endpoint, subscribed to `invoice.paid`, `invoice_payment.paid`, `invoice.voided`, `invoice.marked_uncollectible`, `charge.refunded`, and `refund.updated` on API version `2026-09-30.endive`. Alchemy binds the endpoint's signing secret onto the Worker.

Deploy from `apps/payments` with Node 24: run the database migrations (`bun run db:migrate`), then `bun run deploy` with `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STRIPE_API_KEY` (creates the endpoint), `STRIPE_SECRET_KEY`, and `DATABASE_URL`. `bun run dev` runs it in workerd against a reachable `DATABASE_URL`; `stripe listen --forward-to localhost:1337/stripe/webhook` forwards deliveries and prints the `STRIPE_WEBHOOK_SECRET` to set.

The flow was checked against a local stand-in for the Stripe API, with Stripe's real Payment Element drawn in the browser. A run with the Invoicing sandbox's own keys is still needed: it confirms how Stripe reports `tax_amounts` totals and a real card payment end to end.

## Quotes

A quote (presupuesto) is an offer the customer accepts online. It is no tax document and has no invoice number: quotes run in a plain series of their own, `P-2026-0001`. [Research and sources](../research/quotes-editor-mcp.md).

- **Pages** (`packages/invoices/src/page-schema.ts`, `pages.ts`): the long-form writing after the priced lines, stored as ProseMirror JSON. One Tiptap extension list defines what pages hold; the editor, the server's validation, the Markdown agents write (`::page-break`, `::clause[id@version]`), the PDF renderer (`page-render.tsx`) and the customer's page all read it.
- **Clauses** (`clauses.ts`): versioned, bilingual conditions, each with its legal source and the customers it may go to. A published version never changes its words; new words are a new version.
- **Notices** (`quote-notices.ts`): what the quote prints whatever its pages say, by customer type: validity, prices with taxes, how to accept, withdrawal with the annex B form, customer service, and data protection.
- **The studio** (`features/invoices/pages-studio.tsx`, `pages-editor.tsx`): the pages on a sheet set to the PDF's own measure, with `/` for blocks and clauses, a format bar on a selection, an outline, the clause library, and the notices that will print.
- **Plans**: a quote offers one to four payment plans, as an invoice does, and prints them as sentences. They count from acceptance ("30 % on acceptance") to the quote's planned delivery ("the rest on delivery"). They are fixed once the quote is issued: they are part of what the customer accepts.
- **Acceptance** (`quotes.ts`, `features/invoices/quote-page.tsx`): the owner sends a link; the customer reads the quote, chooses a plan, types their full name and draws their signature (a simple electronic signature), and accepts. A consumer can ask for work to start inside the withdrawal period. The answer keeps the network address, the browser and the SHA-256 of the exact PDF read, and is confirmed by email to the customer, with a notice of its own to the owner. An acceptance also carries a drawn signature; both emails attach the signed copy, which is the accepted PDF with a last page that records the acceptance, and the customer's link serves that copy from then on.
- **Billing** (`billing.ts`): every payment of the accepted plan gets an invoice of its own, as Real Decreto 1619/2012 art. 2.1 requires for payments taken before the work is done (the Canary Islands apply it to IGIC through Decreto 268/2011, art. 47 decies). Each invoice carries its share of every quoted line, so tax treatment, withholding and disbursements stay as quoted; the last one takes what is left of each line, so the invoices add up to the quote. IGIC is rounded on each invoice's own base, so the invoices' totals can differ from the quote's by a cent. The accepted plan is kept with the answer, so later edits never move it, and an invoice billed from a quote takes no plan of its own.

## Agents over MCP

An agent can do everything the owner can in the invoice pages, through an MCP server at `/invoices/mcp` (`apps/start/src/features/agent`). [Research and sources](../research/quotes-editor-mcp.md#the-agent-surface).

- **Transport**: Effect's `McpServer` over Streamable HTTP, on the app's own runtime, so an agent and the owner share the services and the database. It speaks MCP 2026-07-28, 2025-11-25 and 2025-06-18.
- **Sign-in**: better-auth is the OAuth 2.1 server for agents (`@better-auth/mcp`), with Client ID Metadata Documents (`@better-auth/cimd`). An agent sends the owner to `/invoices/connect`, where they sign in as always and approve it once; its token is bound to the MCP endpoint and the `invoices` scope. The discovery documents answer at their root `/.well-known/...` paths.
- **Access**: every call checks that the token is the owner's and that the owner still approves the agent. Settings › Agents lists the agents and disconnects one at once; a disconnected agent is told to sign in again.
- **Tools** (`tools.ts`, `handlers.server.ts`): 27 tools that call the same operations as the pages, plus each document's PDF as a resource. `coverage.ts` maps every page action and server function to its tools, and the type checker and `coverage.test.ts` keep that map complete; see [`AGENTS.md`](../../AGENTS.md).
- **Origin**: tokens name a fixed origin. Production uses the site; development uses `INVOICE_ORIGIN`, or the Astro dev server's own address.

## Issue operation

The server authenticates the owner, checks the draft revision, decodes the input, calculates totals, and applies the issuer's tax policy.

A database transaction allocates the number, freezes the invoice snapshot, and records required audit and delivery work. A unique idempotency key makes repeated clicks and retries return the same result. Concurrent requests cannot allocate the same number.

PDF generation and any external submission use recoverable work records. A renderer failure cannot silently delete an issued invoice or reuse its number. Download, submission, and payment states remain separate from legal issue state.

Corrections preserve the original invoice. Draft deletion and legal rectification are separate operations. Issued invoice snapshots cannot change when an issuer, customer, catalog item, or template later changes.

## Canary Islands compliance

Compliance covers the invoice contents, the issuer's tax treatment, and the obligations of the invoicing software. The PDF renderer covers document production only.

The requirements matrix must map every implemented rule to a source and an executable case. It must cover numbering, identity, dates, descriptions, tax bases, rates, tax amounts, required legends, corrections, and retention. [Invoice regulation](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).

Support ordinary IGIC, REPEP, and company issuer profiles. Legal form and tax regime are separate fields. Profile changes have effective dates and never rewrite issued invoices. Model IGIC exemption, zero rate, outside scope, and reverse charge separately. REPEP is an issuer regime, not a generic zero-rate switch. Applicability depends on the issuer and transaction. [ATC REPEP guidance](https://www3.gobiernodecanarias.org/tributos/atc/en/preguntas-frecuentes-repep), [Canary Islands invoicing records](https://www.gobiernodecanarias.org/boc/2024/063/001.html).

Assess RRSIF/VERI\*FACTU applicability for this issuer, including any SII obligations. Canary Islands location alone does not exclude these software rules. If applicable, implement the required records, chain, QR, submission behavior, failure recovery, and producer declaration before claiming completion. [AEAT scope](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html).

Select the reporting mode and any provider after checking the issuer's obligations. Live submission needs the issuer's authorization and credentials. Development fixtures must never reach a production tax endpoint.

Structured electronic invoice obligations require a separate applicability check. A PDF/A file or embedded XML does not establish tax compliance. Takumi explicitly leaves invoice XML and tax validation to the application. [Takumi invoice guidance](https://takumi.kane.tw/docs/pdf/invoices).

## Sign-in

[better-auth](https://www.better-auth.com) owns sessions, cookies, rate limits, and the sign-in tables. It answers under `/invoices/auth` and shares the invoice database through its Drizzle adapter. Two kinds of people sign in, and one gate admits them: better-auth's `user.validateUserInfo`, in `features/auth/auth.server.ts`. Every other way in, such as password sign-up, is closed.

**The owner** signs in with AT Protocol through `@portfolio/auth-atproto`, a better-auth plugin in `packages/auth-atproto`. It runs the protocol's OAuth profile with the official `@atproto/oauth-client-node`: PAR, PKCE, DPoP, and a signed state cookie that ties the callback to the browser that started it. It requests only the `atproto` scope and revokes the grant inside the callback, so no token outlives the sign-in. The DID is the account key and the user's `did` field, which no user input can set. The gate admits only the configured owner DID; a handle is a sign-in convenience, never the authorization identifier. Local development runs as a loopback client and needs no keys. [AT Protocol OAuth](https://atproto.com/specs/oauth).

**Customers** sign in with a six-digit code sent to the address their invoices are billed to (better-auth's email OTP). Proving that inbox opens every issued invoice billed to it at `/invoices/account`, with each PDF, and nothing else. An address can open an account only while one of its invoices has a payment link open, so the payment page is where the account is offered. Codes go only to existing customers and to addresses that may open an account, and the answer is the same for every address, so nobody learns who is a customer. Codes are stored hashed and live ten minutes.

| Variable               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `INVOICE_SECRET`       | 32 random bytes in base64. Signs sessions and encrypts the OAuth flow state           |
| `INVOICE_ATPROTO_KEYS` | A JSON array of private ES256 JWKs, newest first. `bun run --cwd apps/start atproto-key` prints one |
| `RESEND_API_KEY`       | A [Resend](https://resend.com) API key with sending access, for the invoice mail      |
| `INVOICE_MAIL_FROM`    | The sender, on a domain verified in Resend, for example `Hadronomy <invoices@hadronomy.com>` |

Production refuses to start without `INVOICE_ATPROTO_KEYS`. Without Resend, production offers no customer accounts, and development writes each email to `<data directory>/mail` as an HTML file, a text copy and its attachments, and logs the path. Sign in at `http://127.0.0.1:<port>`, not `localhost`: the protocol forbids `localhost` in loopback redirects.

Invoice and customer data stay in the private database. Do not publish them into the owner's AT Protocol repository.

## Mail

Resend sends the invoice mail: the customer's sign-in code, a quote sent by email, the confirmation of an answer to a quote (Ley 34/2002, art. 28), and the owner's notice of it. A quote email carries a new link, the PDF and the owner's note, shows no price (the customer reads it on the quote, with its terms), and replies go to the owner; the owner composes it beside a live preview, and each send is kept in the audit log, which the quote panel and agents (`email_quote`, `get_document`) read back. Each email is a React Email component in `apps/start/src/emails`, rendered to HTML and plain text, and speaks the messages in `packages/i18n`: the customer's in the language they read, the owner's in English. The drawn signature travels as an inline PNG, because mail clients do not show SVG. Answers send with an idempotency key, so a retry never doubles them. `bun run --cwd apps/start emails` opens the React Email preview of every template.

## PDF pipeline and viewer

Takumi renders a versioned invoice snapshot with local font assets and a shared document template. The template supports repeated table headers, multiline descriptions, page numbers, tax summaries, and totals that stay together when they fit. [Takumi PDF](https://takumi.kane.tw/docs/pdf).

Evaluate tagged PDF/A output against actual generated invoices. Validate selected conformance with veraPDF and check text extraction, language, font coverage, table semantics, and reading order. Do not infer compliance from a render option alone. [Takumi conformance](https://takumi.kane.tw/docs/pdf/pdf-a).

Load EmbedPDF and its worker only when the preview opens. Use its headless rendering, selection, scrolling, zoom, search, and page controls with the application's visual system. Self-host the worker and WASM assets. [EmbedPDF headless](https://www.embedpdf.com/docs/react/headless/introduction).

Debounce draft previews and discard superseded results. Keep the last valid PDF visible while the next revision renders. Preserve zoom and scroll where possible. Virtualize pages and release replaced documents and object URLs.

Preview, download, and print use the same completed PDF artifact. The interface identifies an outdated preview. Issue always uses the latest validated snapshot.

## Delivery order

Each layer ends with usable behavior and focused tests. Keep the existing Astro/Start integration in its own lower branch.

1. **Document proof:** Render a bilingual, multipage invoice with decimal totals through the shipped Takumi package. Open it in a styled EmbedPDF pane through Start. Check Node and Vercel WASM packaging before building the full editor.
2. **Domain and storage:** Add schemas, calculations, PostgreSQL tables, local PGlite, customer/item records, and transactional draft persistence. Test money, adjustments, tax groups, and revision conflicts.
3. **Private access:** Add AT Protocol OAuth, DID restriction, protected server functions, and private PDF responses. Exercise a denied account and expired session. Customer accounts follow online payment, since payment links open them.
4. **Complete authoring:** Add the invoice list, editor, customer/item management, issuer settings, autosave, bilingual output, and responsive layouts. Apply the supplied composition and shared motion/text controls throughout.
5. **Invoice lifecycle:** Add idempotent issue, numbering, immutable snapshots, PDF artifacts, rectification, payment allocation, backup/export, and recovery states.
6. **Applicable compliance:** Complete the issuer-specific rules and required reporting path. Verify against official cases and the appropriate non-production service.
7. **Release checks:** Run financial, security, browser, PDF, accessibility, performance, and deployment checks. Confirm the original one-command development workflow still works.

These are implementation layers, not a proposal to stop after a prototype. The full requested application includes all applicable layers.

## Acceptance criteria

- A draft survives reload, a failed save, and a recoverable network interruption.
- Two issue requests with one idempotency key produce one invoice number.
- Issued totals and identity do not change after editing reusable records.
- Mixed taxes, decimal quantities, discounts, advances, and corrections reconcile to independently calculated expectations.
- English and Spanish documents show the same amounts and preserve accents and currency symbols.
- A long invoice has no clipped lines, lost totals, blank overflow pages, or unreadable text.
- The preview and download contain the same PDF bytes for the selected artifact.
- Only the configured DID can read or mutate private records, including direct endpoint requests.
- Client navigation, focus, reduced motion, keyboard editing, and mobile preview work.
- Form edits do not rerender the entire workspace. Superseded PDF jobs never replace newer previews.
- Measure PDF generation and visible-page rendering on representative invoices. Report measured results rather than assuming performance from the library choice.
- Node and Vercel builds include all PDF fonts, workers, and WASM assets.
- The compliance claim lists its exact issuer profile, supported transaction types, standards, tests, and remaining exclusions.

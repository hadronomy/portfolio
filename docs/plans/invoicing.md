# Invoicing application plan

This document defines the application to build and the order of delivery. It is a proposed design, not a completion report.

## Confirmed brief

- A private invoicing application under `/invoices`, inside the existing TanStack Start application.
- One owner, a server database, and AT Protocol sign-in restricted to the owner's DID.
- Canary Islands invoicing with IGIC. Invoice language supports English and Spanish independently of tax treatment.
- Takumi generates every PDF. The integrated viewer displays those same PDF bytes.
- The attached Studio Bakers reference sets the composition: dark frame, slim navigation rail, copper workspace, and separate inspector.
- BoardUI informs application-wide component states and motion. Do not install or copy its component library.
- DialKit informs compact controls and motion tuning. Torph owns changes to displayed interface text.
- The existing one-command Astro/Start development and build workflow remains the entry point.

The owner signs in as `hadronomy.com`. DNS and the DID document both resolve it to `did:plc:tvgjv46t4ebxbrvekr2vrnls`, checked on 9 September 2026. Configure authorization with that DID. Support ordinary IGIC, REPEP, and company profiles with effective dates. A database provider and deployment credentials are needed for hosted operation.

## Product experience

The invoice document is the main visual object. A white page sits on a muted copper workspace inside a dark application frame. The surrounding controls stay quiet.

The navigation rail contains invoices, customers, items, and issuer settings. The invoice list uses aligned rows, search, saved filters, and keyboard navigation. Totals supplement the list instead of taking over the first screen.

Opening an invoice uses Start client navigation. The editor has a document workspace and a resizable inspector. The inspector groups customer, dates, line items, tax, payment terms, and appearance. On narrow screens, editor and preview occupy separate accessible tabs.

Line items use an editable table with keyboard movement, duplication, insertion, and reorder controls. Optional fields open in context. Adding a customer from the editor preserves the unfinished invoice.

Drafts save automatically. The interface distinguishes local edits, saving, saved, and failed saves. Failed saves retain the draft and offer retry. Concurrent edits produce a recoverable conflict instead of silently overwriting data.

Issuing an invoice is a separate action from saving or downloading a draft. The review view shows the exact invoice, totals, required fields, and number series. A completed issue operation opens the immutable invoice.

Payments have their own records. Partial payment, settled, and overdue displays come from payment allocations and due dates. Downloading a PDF never marks an invoice as sent or paid.

The first PDF design uses restrained typography, clear tax breakdowns, generous margins, and a compact issuer identity. Application atmosphere does not become a colored background on printed invoices. Names and logos come from the issuer's saved data.

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
| Durable storage             | PostgreSQL with Drizzle                             | Transactions, constraints, decimal columns, and server-owned records               |
| Local development storage   | PGlite through Drizzle                              | Persistent local PostgreSQL without an additional database server                  |
| Domain schemas and services | Effect v4, pinned release candidate                 | Fits typed failures, server operations, and the requested Effect Craft conventions |
| Decimal arithmetic          | decimal.js                                          | Exact decimal operations with explicit rounding rules                              |
| Sign-in                     | Official `@atproto/oauth-client-node`               | Protocol OAuth and stable DID identity                                             |
| PDF generation              | `takumi-pdf`                                        | Paged documents, embedded fonts, and selectable text                               |
| PDF viewer                  | EmbedPDF headless React                             | PDFium rendering with application-owned controls                                   |
| Accessible controls         | Existing Radix primitives, extended where necessary | Keeps keyboard and focus behavior on established primitives                        |
| Motion                      | Existing Motion plus Torph                          | Layout/state motion and consistent text changes                                    |

TanStack DB is the client data layer. PostgreSQL remains the authoritative database. Issuing invoices and allocating legal numbers never use optimistic client completion. [TanStack DB](https://tanstack.com/db/latest/docs/overview), [TanStack Form](https://tanstack.com/form/latest/docs/overview).

PGlite is the deliberate local database target. Production uses hosted PostgreSQL through the same schema. Production must fail clearly if database configuration is absent. Financial data cannot fall back to an ephemeral serverless filesystem. [Drizzle PGlite](https://orm.drizzle.team/docs/connect-pglite), [PGlite](https://pglite.dev/docs/).

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

## Private AT Protocol sign-in

Use the official server OAuth client with persistent state and session stores. The public client metadata and callback belong to the invoice application. Use the protocol's documented loopback flow during local development. [AT Protocol OAuth](https://atproto.com/guides/oauth-tutorial).

Configure the owner's DID explicitly. A successful OAuth login must match that DID before the application creates a private session. A handle is a sign-in convenience, not the authorization identifier. Never use first-login ownership.

Check authorization on every invoice operation, PDF response, and data export. Use secure HTTP-only session cookies and the OAuth client's state, PKCE, and DPoP handling. Keep refresh material and signing keys server-side.

Request only the scope needed for identity. Invoice and customer data stay in the private database. Do not publish them into the owner's AT Protocol repository.

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
3. **Private access:** Add AT Protocol OAuth, DID restriction, protected server functions, and private PDF responses. Exercise a denied account and expired session.
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

# Headless Stripe invoicing with Effect v4

Research date: 30 September 2026.

This document records the integration recommendation, its evidence, and the work required to prove it. It does not report an implementation.

Repository inspection used `/Users/hadronomy/.t3/worktrees/portfolio/t3code-08ad6a4a`. The research changed no application code, installed no packages, and made no Stripe account changes.

## Decision

Use Stripe Invoicing with a Payment Element on the custom customer invoice page. Keep the existing invoice domain, numbering, calculation, and Takumi PDF authoritative.

Use the official Stripe SDK behind a small Effect v4 service. Keep provider types inside the adapter. Validate the external data that the application consumes with Effect Schema.

Stripe documents this headless path. Invoice finalization creates the associated PaymentIntent. An expanded `confirmation_secret` supplies its client secret to the normal Elements integration. [Stripe Invoicing integration](https://docs.stripe.com/invoicing/integration).

The integration has a release gate: the Stripe invoice must preserve the local invoice's accounting meaning and collectible balance. A matching final amount alone is insufficient.

If a faithful projection is impossible, choose PaymentIntents with a Payment Element as the collection boundary. Make that product decision explicit. Do not add an automatic fallback between two financial models.

## Repository findings

| Area | Current repository evidence |
| --- | --- |
| Frontend | React 19, TanStack Start and Router, Query, DB, and Form |
| Backend runtime | Node, with Astro as the public application shell |
| Deployment | The Astro adapter selects Vercel through `VERCEL`, with a standalone Node alternative |
| Database | Drizzle, hosted PostgreSQL for production, PGlite locally |
| Effect | Exactly `4.0.0-rc.112` |
| Documents | Takumi PDF generation and EmbedPDF viewing |
| Identity | Private owner access through an AT Protocol DID |
| Package manager | Bun, independently of the Node runtime |

Sources: [Start dependencies](../../apps/start/package.json), [root package](../../package.json), [deployment adapter](../../apps/astro/astro.config.mjs), [invoice package](../../packages/invoices/package.json), and [invoicing plan](../plans/invoicing.md).

The configuration does not establish the active production database provider or prove a remote deployment.

Custom invoices already include both custom documents and a local ledger. The domain contains issuer and customer snapshots, numbering, rectifications, tax treatments, withholding, and payment reversals. [Invoice model](../../packages/invoices/src/model.ts).

The calculator uses decimal strings and `Decimal.ROUND_HALF_UP`. It rounds line bases, apportions document discounts, rounds tax by group, subtracts withholding, and adds disbursements. [Calculator](../../packages/invoices/src/calculate.ts).

The store issues an invoice inside a transaction. It allocates a permanent number and binds an issue key to the invoice. Stripe calls must remain outside that transaction. [Invoice store](../../packages/invoices/src/store.ts).

The current tables contain invoices, sequences, directory records, document artifacts, audit records, and sessions. They do not contain durable Stripe operations, webhook acceptance, or provider allocation provenance. [Database tables](../../packages/invoices/src/tables.ts).

## Stripe API choice

| Path | Fit for this application |
| --- | --- |
| Stripe Invoicing and Payment Element | Fits invoice tracking in Stripe, subject to faithful fiscal projection |
| PaymentIntents and Payment Element | Fits an application that owns all invoicing and uses Stripe only to collect the balance |
| Checkout Sessions and Elements | Fits general checkout, but adds another checkout model alongside the existing invoice domain |

Stripe recommends Checkout Sessions for many new Payment Element integrations. The separate Invoicing guide documents the invoice-backed integration required here. [Payment Element integration choices](https://docs.stripe.com/payments/payment-element).

A finalized Stripe invoice already has its default payment. A separate Checkout Session for the same debt introduces another collection path. The application must not create it as part of the invoice-backed design.

Stripe currently lists Invoicing Starter at 0.4% and Plus at 0.5% per paid one-time invoice. Payment processing fees are additional. Account-specific agreements can change the applicable price. [Stripe Invoicing pricing](https://support.stripe.com/questions/stripe-invoicing-pricing?locale=en-GB).

## Invoice collection lifecycle

The proposed lifecycle has eight stages. These stages describe the architecture, rather than an executable setup procedure.

1. **Local issuance.** The existing transaction allocates the invoice number and preserves its issued snapshot. A durable operation records collection preparation.
2. **Stripe draft.** The workflow creates a draft from the issued snapshot, with the existing number, currency, customer, and due date.
3. **Item projection.** Each invoice item belongs to that specific draft. Metadata identifies the local invoice and projection version.
4. **Draft comparison.** The workflow compares line amounts, tax groups, discounts, adjustments, total, and existing payment or credit allocations.
5. **Explicit finalization.** The workflow finalizes the draft and expands `confirmation_secret`. It evaluates the resulting collection state again.
6. **Customer result.** The application returns a small authorized DTO with the invoice number, currency, remaining balance, and payment state.
7. **Payment confirmation.** The browser mounts the Payment Element and calls `stripe.confirmPayment`. Authentication, redirects, and processing have explicit states.
8. **Ledger settlement.** Verified provider settlement creates or updates local records. A browser success screen does not create a payment record.

The draft uses the following policy:

| Parameter | Policy |
| --- | --- |
| `collection_method` | `send_invoice` |
| `auto_advance` | `false` |
| `automatic_tax.enabled` | `false` |
| `number` | Existing local invoice number |
| Due date | Existing invoice due date |
| Pending invoice items | Excluded unless the workflow explicitly owns them |
| Metadata | Local invoice ID and projection version, without secrets or unnecessary personal data |

Stripe accepts a supplied invoice number with a 26-character limit. The local sequence remains the numbering authority. [Create an invoice](https://docs.stripe.com/api/invoices/create).

Items attach to an explicit invoice. Current fields support negative amounts and decimal quantities. Loose pending customer items risk inclusion in another invoice. [Create an invoice item](https://docs.stripe.com/api/invoiceitems/create).

After finalization, the workflow reads `confirmation_secret.client_secret`. It uses the ordinary `Elements` provider and `PaymentElement`, then `stripe.confirmPayment`. [Headless invoice payment integration](https://docs.stripe.com/invoicing/integration).

Zero balances, credits, or other settlement conditions can produce no usable payment form. The response model needs a settled state and an unavailable state.

If Stripe is unavailable, the local issued invoice remains intact. The durable operation resumes collection preparation later. The workflow must not issue another local invoice during a retry.

`auto_advance: false` stops automatic advancement and collection behavior. The application then owns delivery, reminders, and recovery. Receipt email configuration needs separate attention. [Automatic advancement and collection](https://docs.stripe.com/invoicing/integration/automatic-advancement-collection).

The custom Takumi PDF remains the customer document. Stripe also produces its own PDF and hosted invoice URL. Hiding these links does not remove the artifacts. [Finalize an invoice](https://docs.stripe.com/api/invoices/finalize).

## Fiscal projection gate

The local calculation is the authority. The Stripe projection must preserve its amounts and their meaning.

| Domain feature | Proposed treatment and required proof |
| --- | --- |
| Ordinary IGIC | Explicit manual tax rates with the correct label and jurisdiction |
| Grouped tax rounding | Invoice-level Stripe rounding, compared with the local calculation |
| Exempt and outside-scope lines | Distinct treatment and reason retained in the projection |
| Reverse-charge and REPEP | Explicit treatment, with proof of document and amount semantics |
| Withholding | Withholding remains distinct from a discount or negative tax |
| Disbursements | Separate accounting treatment remains intact |
| Fractional quantities | Current decimal fields or authoritative calculated line amounts |
| Currency amounts | Exact, validated integer minor units derived from decimal strings |

Stripe supports manual tax labels and configurable rounding. The research did not establish complete automatic Stripe Tax support for this application's IGIC and REPEP rules. [Manual tax rates](https://docs.stripe.com/tax/tax-rates).

The recommendation therefore retains local tax policy and disables automatic tax. This is an integration decision, not a conclusion that Stripe Tax never supports those rules.

For an arithmetic fixture, €1,000 base plus €70 IGIC minus €150 withholding produces €920 collectible. This example does not establish the legal applicability of those rates.

A negative Stripe item can reduce the amount due. It does not establish native withholding semantics. The projection must retain taxable base, tax, withholding, and money owed as distinct concepts. [Invoice item amounts](https://docs.stripe.com/api/invoiceitems/create).

The existing discount allocation and tax grouping also need fixture comparison. Equal totals can conceal different taxable bases or exemption treatment.

Existing bank or cash payments need reconciliation before collection begins. A new Stripe invoice for only the unpaid remainder cannot represent the original full invoice under its number.

The research did not prove an account-specific path for recording every external partial payment. That path remains part of the release gate.

## Effect v4 architecture

The existing TanStack Start server functions remain the framework boundary. Effect owns asynchronous backend work inside that boundary.

The reference Matt Pocock post recommends filling asynchronous backend functions with Effect. It supports this placement without introducing another application framework. [Reference post](https://x.com/mattpocockuk/status/2105035085800226849?s=20).

The inspected opencode `v2` branch pins Effect `4.0.0-rc.112`, the same version as this repository. Its services use explicit interfaces and dependency acquisition. [Pinned version](https://github.com/anomalyco/opencode/blob/760f87fab1842170c70f43ad7fa38f8bf0aa19e4/package.json).

Its service patterns include `Context.Service`, dependencies through `yield*`, `Layer.effect`, and named `Effect.fn` operations. Those patterns fit this integration. [Pinned service source](https://github.com/anomalyco/opencode/blob/760f87fab1842170c70f43ad7fa38f8bf0aa19e4/packages/core/src/session.ts).

The design has four boundaries:

| Boundary | Responsibility |
| --- | --- |
| Invoice schemas and calculation | Existing domain truth and pure decimal arithmetic |
| Stripe projection | Pure conversion from an issued snapshot into provider inputs |
| Stripe service | Provider calls, consumed response schemas, request metadata, and provider failures |
| Invoice collection workflow | Authorization, durable operations, reconciliation, and ledger updates |

The public service exposes application operations such as collection preparation, collection state, and settlement reconciliation. It does not reproduce the full Stripe API.

Schema-derived types and branded IDs distinguish local invoices, Stripe invoices, PaymentIntents, and payment allocations. Amount types retain currency and exact units.

Effect Schema validates incoming requests, persisted operation payloads, webhook envelopes, and consumed provider responses. SDK type declarations alone do not prove runtime values.

Named `Effect.fn` operations retain explicit service dependencies. Layers provide configuration, credentials, persistence, and the provider adapter. Credentials use redacted values in server memory.

Pure calculation remains pure. Effect owns I/O, failure handling, configuration, scheduling, and orchestration. Native React hooks and Elements lifecycle remain ordinary React code.

The native request boundary runs Effect and returns serializable domain values. It does not expose provider objects or runtime services to React. [Current server function boundary](../../apps/start/src/features/invoices/api.ts).

Expected payment states form a tagged union. Typed errors represent failed operations. A single loading boolean cannot express authentication, delayed settlement, failure, and reconciliation.

The implementation must use APIs from the installed v4 version. Effect's migration replaces v3 service APIs with `Context.Service`. [Effect service migration](https://github.com/Effect-TS/effect/blob/10d8524dc40fd06075f6a70f88d3a0cbd3477178/migration/services.md).

The design does not need a generic payment-provider framework, a second application runtime, or a replacement for TanStack Start.

## SDK assessment

| SDK | Evidence | Decision |
| --- | --- | --- |
| Official `stripe` | Provider-maintained protocol, invoice types, signature verification, and retry behavior | Best fit for the current repository |
| `@distilled.cloud/stripe` | Effect-native operations, schemas, tagged errors, and invoice coverage | Candidate that needs dependency and contract proof |

The official SDK still needs runtime validation. A narrow adapter wraps Promise operations with Effect and decodes the response shapes that the application consumes. SDK types stay inside that adapter. [Official Stripe Node SDK](https://github.com/stripe/stripe-node).

The SDK and Stripe API version need a deliberate pin. Webhook payload versioning also needs explicit treatment. Historical event shapes cannot become current types through an assertion.

The published Distilled `1.0.0-rc.12` package requires Effect `rc.115` or later. This repository pins `rc.112`. [Published package](https://www.npmjs.com/package/@distilled.cloud/stripe).

The published package includes invoice creation, finalization, retrieval, payment attachment, and payment listing operations. Its Stripe protocol lacks the response-validation implementation present in the inspected current source.

The inspected source adds strict response validation, but defaults to lenient validation. A declaration of full type safety therefore needs explicit validation policy. [Current Stripe protocol](https://github.com/alchemy-run/distilled/blob/1f4a62973c57b4b00044a99611c00717ec9b69cb/packages/stripe/src/protocol.ts), [response validation](https://github.com/alchemy-run/distilled/blob/1f4a62973c57b4b00044a99611c00717ec9b69cb/packages/core/src/response-validation.ts).

Published package contents and current source were inspected separately. They are not interchangeable evidence for a release.

A future Distilled decision needs an intentional Effect upgrade and the same invoice fixtures, error contracts, and recovery proof. This research does not establish that proof.

## Durable operations and webhook processing

The current manual payment operation deduplicates local payment IDs. It rejects payments larger than the remaining balance. Provider settlement needs additional provenance and handling. [Invoice store](../../packages/invoices/src/store.ts).

The proposed persistence contracts are:

| Record | Contract |
| --- | --- |
| Webhook inbox | Unique account, mode, and event ID, with durable acceptance and processing state |
| Provider operation | Frozen request parameters, stable idempotency key, and recoverable execution state |
| Provider receipt and allocation | Unique provider IDs, exact amounts, currency, and local invoice association |
| System audit actor | Stripe-originated changes have an explicit system identity |
| Reconciliation result | Records unknown outcomes, balance differences, and required recovery |

Webhook signature authentication uses the raw request body. Durable acceptance precedes the successful HTTP response. Processing can then resume after a crash. [Stripe webhooks](https://docs.stripe.com/webhooks).

Event IDs prevent duplicate acceptance. Allocation IDs prevent duplicate ledger application across separate events about the same payment. Event timestamps do not provide a reliable sequence.

Stripe retains idempotency keys for at least 24 hours. Local operation records need a longer lifetime. Unknown results and expired keys require reconciliation before recreation. [Idempotent requests](https://docs.stripe.com/api/idempotent_requests).

Each mutation needs a stable key for that operation and frozen parameters. One key must not identify different requests. Network retries preserve the same request and key.

Some `500` responses represent an indeterminate outcome. A new key can duplicate a successful remote action. [Low-level error handling](https://docs.stripe.com/error-low-level).

One layer owns retries. If Effect owns retries, the adapter disables SDK network retries and applies a bounded policy. The policy respects Stripe retry guidance and delay headers.

Effect cancellation does not prove cancellation of a remote financial operation. The durable workflow still reconciles its outcome.

A request-scoped background fiber does not provide durable execution on Vercel. Work persists before the request ends and resumes through recoverable job invocations.

## Partial payments and settlement

The default invoice payment tracks the remaining balance. A chosen partial amount uses a separate PaymentIntent, attached before confirmation. Stripe creates an `InvoicePayment` allocation. [Partial payments](https://docs.stripe.com/invoicing/partial-payments).

Local settlement uses paid allocations and their allocated amounts. Reconciliation reads all pages. The PaymentIntent total does not necessarily equal this invoice's allocation. [Invoice Payments API](https://docs.stripe.com/api/invoice_payments).

`invoice.paid` is not proof of a new receipt for the full invoice amount. Credits or out-of-band settlement can also produce a paid invoice. [Invoice lifecycle](https://docs.stripe.com/invoicing/overview).

Mixed Stripe and external settlement needs one reconciled balance. The workflow must not mark a partly paid invoice fully paid through an out-of-band shortcut.

Concurrent payment attempts can produce excess receipts or customer credit. Receipt records preserve the actual provider outcome. Allocation records identify the amount applied to the invoice.

The existing manual payment guard cannot discard a real provider receipt. Excess funds need reconciliation and an explicit disposition. [Invoice overpayments](https://docs.stripe.com/invoicing/partial-payments#prevent-invoice-overpayment).

Refunds, payment reversals, credit notes, and legal rectifications remain separate concepts. They require linked records rather than changes to the original issued snapshot.

## Customer access and payment state

The existing `/invoices` workspace is private to the owner. A customer payment page needs a separate access model. [Owner authentication](../../apps/start/src/features/invoices/auth.server.ts).

The proposed access grant is invoice-specific, revocable, and time-limited. The database stores a hash of its opaque token. The customer DTO contains only authorized invoice information.

PDF access uses the same explicit customer scope. An existing owner-only download route cannot become public through a payment link.

The Stripe webhook authenticates the signature. It does not use the owner cookie or the same-origin policy for owner mutations.

The browser uses official React Stripe bindings. `loadStripe` lives outside rendering. The Elements instance remains stable throughout an attempt. [React Stripe.js](https://docs.stripe.com/sdks/stripejs-react?ui=elements).

An actual payment attempt change can require a remount. Theme changes, document viewing, and unrelated state updates must preserve entered payment details.

`stripe.confirmPayment` can resolve with an error value. The adapter maps that result explicitly. A Promise rejection handler alone cannot represent every payment failure.

| State | Customer experience |
| --- | --- |
| Ready | Exact remaining amount and one clear payment action |
| Submitting | Duplicate submission blocked, with the entered form preserved |
| Authentication required | Stripe authentication continues |
| Processing | Payment confirmation remains pending |
| Paid | Server-confirmed settlement appears |
| Failed | A useful nearby error and a recovery action appear |
| Unavailable | The page explains that collection needs reconciliation |

The return page reads authorized server state. It does not treat URL parameters as settlement authority. A delayed webhook leaves the payment processing until reconciliation confirms it.

Optimistic UI updates cannot establish financial settlement. The local ledger remains the source for the application balance and paid state.

## Design engineering

The existing invoice document supplies the visual identity. Payment controls use a stable, legible surface beside the actual invoice content.

Financial columns use shared alignment and tabular numerals. Focus and layout remain stable after an error. [Craft: tabular numbers](https://craft.gustavofior.com/tabular-numbers).

The Appearance API provides the supported customization boundary. Public rules and resolved tokens control typography, spacing, and focus treatment. Iframe fonts require explicit provision. [Elements Appearance API](https://docs.stripe.com/elements/appearance-api?api-integration=paymentintents).

The payment form needs readable mobile inputs and clear contrast. The integration does not manipulate private iframe styles or reproduce sensitive payment inputs.

Motion communicates state changes or orientation. Frequent actions respond immediately. Reduced-motion preferences remain effective, and content stays visible before any animation completes. [Craft: hover restraint](https://craft.gustavofior.com/hover-restraint), [Emil Kowalski on animation](https://emilkowal.ski/ui/you-dont-need-animations).

The visible action names the exact collectible amount. Failure messages appear near the relevant action. Status updates preserve keyboard focus and use accessible announcements.

The design retains the existing type and document language. It does not replace the invoice with a generic checkout dashboard.

## Required proof before release

| Proof area | Required coverage |
| --- | --- |
| Fiscal fixtures | IGIC, REPEP, withholding, disbursements, fractional quantities, discounts, and tax rounding |
| Projection equality | Line and group semantics, totals, prior payments, and customer credits |
| Payment lifecycle | Full payment, partial payment, authentication, redirects, and delayed settlement |
| Recovery | Duplicate and unordered webhooks, retries, crashes, and unknown provider outcomes |
| Ledger behavior | Overpayment, refunds, reversals, and rectifications |
| Authorization | Customer isolation, expired or revoked grants, and protected PDFs |
| Interface | Keyboard access, focus, mobile inputs, reduced motion, and Elements stability |

The research established the documented APIs and inspected source behavior. It did not execute fiscal fixtures, payment sandbox scenarios, or account-specific external settlement paths.

Implementation starts with the fiscal projection proof. The smallest complete path then covers one issued invoice, one authorized customer page, one payment, and durable settlement.

Partial amounts, external settlement, refunds, and rectifications extend that working path only after their contracts and recovery behavior are proven.

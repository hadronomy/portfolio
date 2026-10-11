# WebMCP in the invoice workspace

Research date: 29 September 2026. This is an integration recommendation, not an implementation report. See [primary-source notes](webmcp-primary-sources.md) for the current API and browser status.

## Decision

Add WebMCP as a small, optional browser layer inside the signed-in `/invoices` workspace. Register tools through `document.modelContext` only when the browser provides it. Keep the invoice store, server validation, owner DID check, revision checks, and issue transaction as the source of truth. The visible React workspace remains the place where the owner reviews agent changes.

Use the imperative API first. This workspace uses TanStack Form, autosave, route state, and an existing review dialog. The imperative API can call those operations and keep the UI in sync. The declarative API works best for ordinary HTML forms; its agent-filled fields need a visible submission path. [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [Chrome declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api).

Keep the first release behind local development or an origin trial. Chrome lists an origin trial from version 149. Edge lists one from version 150. The API is a Community Group draft. Other browsers do not have general support in the official status list. [Implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md), [specification](https://webmachinelearning.github.io/webmcp/).

## Rollout and target tool set

Start with three tools on the open draft: `get_current_draft`, `validate_invoice_draft`, and `open_issue_review`. This tests state access, validation, and the human handoff without adding a new write path. Add list search, navigation, creation, and field edits only after this path works in the origin-trial browsers. The target set is:

| Tool                       | Page state        | Result in the UI                                                                                                                                                    |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_invoices`            | Signed-in list    | Filtered, bounded invoice summaries and a visible list filter. Return IDs, number, customer name, status, date, and total only.                                     |
| `open_invoice`             | Signed-in list    | Navigate to one invoice by ID. Return its route and current status.                                                                                                 |
| `create_invoice_draft`     | Signed-in list    | Create one draft through `newInvoice` and the existing `save` mutation, then open it.                                                                               |
| `get_current_draft`        | Open draft        | Return its ID, revision, selected fields, server-calculated totals, and save state.                                                                                 |
| `validate_invoice_draft`   | Open draft        | Return field issues and a review summary without changing the invoice.                                                                                              |
| `set_invoice_draft_fields` | Open draft        | Set a small group of named, editable fields in TanStack Form. Let the existing draft hook save and show the preview state. Return the saved revision or a conflict. |
| `open_issue_review`        | Open, valid draft | Flush the draft, open the existing review dialog, and return a summary of the fields the owner must check. The owner presses the final **Issue invoice** button.    |

Register only the tools that match the current route and draft state. Abort their registration on route change or sign-out. Read current state at execution time to avoid stale React closures. Chrome recommends a small, distinct tool set, dynamic registration for changing page states, and prompt UI updates after tool calls. [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), [framework discussion](https://github.com/webmachinelearning/webmcp/issues/199).

Do not expose the whole `Workspace` result as one tool output. It contains every invoice, customer, item, payment, and issuer preference. Keep search results short, and fetch one selected record only when the owner opens it. Do not return a PDF as base64 in a tool result. A tool can open the existing preview or return the protected download route.

## Application seam

The app already has the main seam. `WorkspaceProvider` writes successful mutations to one TanStack Query cache. `operations.server.ts` calls the invoice store after `requireOwner()` and, for mutations, `requireSameOrigin()`. The store applies the same schema and revision rules for UI and agent actions.

Put one WebMCP registration component below the signed-in branch of `InvoiceShell`. Keep tool definitions in a small module beside `workspace.tsx`; do not put them in domain or PDF code. Make tool callbacks call the same `mutate()` function as visible controls. For fields in an open editor, call the form's public field setters and the draft flush path. Never write directly to the database from a browser tool.

Use exact wire values for money and quantities. The invoice model stores decimal strings. The model may supply a price such as `"125.50"`; the shared calculator and server compute IGIC and totals. A tool must not accept an AI-calculated tax total as an authority. Return field errors, the saved revision, and the server-calculated totals as compact structured data. [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices).

## Issue and payment boundary

Issuing a document allocates a permanent number and locks its snapshot. The current editor already has a **Review and issue** dialog. `open_issue_review` should show the saved customer, line items, dates, tax treatment, total, and number series. It must stop before the issue mutation. The owner then uses the visible button. This follows the [GOV.UK check answers pattern](https://design-system.service.gov.uk/patterns/check-answers/) and [WCAG 2.2 error prevention for legal and financial data](https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data).

Keep payment recording, payment reversal, invoice deletion, and rectification outside the first tool set. Add each only after its review state, duplicate-call behavior, and recovery path are tested. If a future release exposes a direct consequential action, set `consequentialHint: true` and still require an application-owned confirmation. Annotation hints inform the agent and browser; the server remains the enforcement point. [Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).

## Interface detail

| Before                                                             | After                                                                                                                                          | Concept                                                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The app has no visible sign that an agent changed a draft.         | Show a short “Draft updated” status with the saved revision near the current save state. Keep the content visible while the preview refreshes. | [Hover restraint](https://craft.gustavofior.com/hover-restraint): frequent states need instant feedback.                                                                 |
| The current review dialog serves human edits only.                 | Reuse it after an agent prepares a draft. Show the exact invoice values and a clear final action.                                              | [GOV.UK check answers](https://design-system.service.gov.uk/patterns/check-answers/).                                                                                    |
| Financial columns already use tabular figures and right alignment. | Preserve both when an agent changes a value. Do not animate the numbers in a way that hides the new total.                                     | [Tabular numbers](https://craft.gustavofior.com/tabular-numbers).                                                                                                        |
| The server returns field issues and revision conflicts.            | Show the same issue near its field, include a linked summary, and move focus to the summary after a failed review.                             | [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/), [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/). |

Keep agent activity calm. The tool changes the same visible controls that the owner uses. The PDF preview can show its existing “Updating preview” state while old bytes remain visible. Do not add a parallel chat panel or a second invoice editor. Craft recommends instant response for frequent interactions; Emil Kowalski gives the same reason for omitting repeated animation. [Craft hover restraint](https://craft.gustavofior.com/hover-restraint), [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations).

## Checks before release

1. Test feature detection, sign-in gating, tool registration on route change, and cleanup on sign-out.
2. Test a full agent journey: find a customer invoice, create a draft, edit amounts, review server totals, and stop at the final issue button.
3. Test malformed decimals, unknown record IDs, stale revisions, duplicate calls, cancelled calls, and sign-out during a call.
4. Test focus, keyboard access, screen-reader feedback, reduced motion, and the mobile editor/preview tabs.
5. Inspect registered schemas and outputs with Chrome's Model Context Tool Inspector. Compare agent task success with the ordinary UI path. [Chrome WebMCP testing guidance](https://developer.chrome.com/docs/ai/webmcp), [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices).

WebMCP only makes tools discoverable in a visited page. It does not provide a remote, unattended MCP server. If the product later needs automation without an open browser, design that as a separate backend integration with its own authorization and audit rules. [WebMCP README](https://github.com/webmachinelearning/webmcp/blob/main/README.md).

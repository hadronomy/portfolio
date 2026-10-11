# WebMCP for the invoice application

Research date: 29 September 2026.

## Decision

Use WebMCP as a progressive enhancement for the authenticated invoice editor. Keep the normal React UI and server actions as the product contract, and make the agent surface call the same application logic. Do not make invoice creation, issuing, sending, deletion, or payment recording depend on WebMCP availability.

Start with small imperative tools that read the current draft, validate it, or prepare a review state. Keep consequential mutations behind the existing Review and confirmation flow. The current API is experimental, browser support is narrow, and the standard does not define a universal site permission or confirmation dialog.

## Maturity and support

WebMCP is a Web Machine Learning Community Group Draft Community Group Report. It is not a W3C Standard and is not on the W3C Standards Track. The current specification is dated 29 September 2026 and defines `document.modelContext` as the `Document` entry point. [WebMCP specification](https://webmachinelearning.github.io/webmcp/)

The official implementation-status file currently reports:

- Chrome: Origin Trial in Chrome 149; local development uses `about:flags#enable-webmcp-testing`.
- Edge: Origin Trial in Edge 150, with Chrome as the platform reference.
- ChatGPT Desktop: supported.
- Brave: experimental support in Leo AI chat.
- Meta Ray-Ban Display: planned or rolling out behind device settings.
- Firefox and Safari: standards-position and issue links, with no browser implementation listed.

This table is maintained in the WebMCP repository and can change independently of the specification. [Browser and Agent Implementation Status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)

Chrome's Intent to Experiment lists developer testing in M146, an Origin Trial on desktop, Android, and WebView from M149 through M156, and an estimated shipping milestone of M157. It also records that the specification is incubating, TAG review is pending, and Gecko and WebKit had no signal at the time of the intent. These are milestones and signals, not a guarantee that a stable browser release supports the final API. [Chrome Intent to Experiment: WebMCP](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/7Rx2_OOfBAAJ)

The feature label in that intent still says `navigator.modelContext`, but the current spec, repository README, and Chrome developer documentation use `document.modelContext`. New code should follow the current `document` surface and feature-detect it. [WebMCP README](https://github.com/webmachinelearning/webmcp/blob/main/README.md), [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)

Chrome describes WebMCP as an early preview that is under active discussion and subject to change. It is designed mainly for a browser workflow with a human in the loop; headless use is possible but listed as a limitation. [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)

## Current API surface

| Surface             | Current shape                                                                                                                                                                                                                                                                                      | Invoice use                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Imperative tools    | `document.modelContext.registerTool({ name, title, description, inputSchema, execute, annotations })`; discovery with `getTools()`; execution with `executeTool()`; cancellation with `AbortSignal`.                                                                                               | Best first fit for dynamic React state and existing client actions. Register stable tools when the editor is active and unregister them when their state is no longer valid.                           |
| Tool annotations    | `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, and `debugging`. They are hints to the client or agent.                                                                                                                                                                               | Mark reads as read-only, invoice notes and external text as untrusted when returned, and issue/send/delete/payment tools as consequential. Do not treat a hint as an authorization check.              |
| Declarative tools   | Chrome supports `toolname` and `tooldescription` on HTML forms. Form controls become schema properties; `toolparamdescription`, labels, and `aria-description` improve parameter descriptions. `toolautosubmit` allows agent submission; without it the submit control is focused for user review. | Useful for a simple draft form while preserving a normal HTML fallback. Avoid making the invoice's critical mutation path depend on this surface while its schema and response rules remain unsettled. |
| Lifecycle           | `toolchange`, `toolactivated`, and `toolcancel` events; an `AbortSignal` can unregister a tool and execution receives a cancellation signal.                                                                                                                                                       | Tie registration to the editor lifecycle and use the signal for fetches or long-running validation. Reflect activation and cancellation in the visible UI.                                             |
| Cross-origin access | The `tools` Permissions Policy defaults to `self`. Cross-origin frames need `allow="tools"`; a tool also needs an explicit secure-origin `exposedTo` entry and the caller must request that origin with `fromOrigins`.                                                                             | Keep invoice tools same-origin. Do not expose customer or invoice data to a partner origin unless there is a specific reviewed need.                                                                   |

The imperative API has a defined current IDL and execution model in the draft specification. The declarative section of that specification is explicitly marked TODO. The separate declarative explainer says the exact form-to-JSON-Schema algorithm, response behavior, and some event details are still open. Chrome's declarative documentation describes its current implementation, but those implementation details are not a stable cross-browser contract. [WebMCP specification, §4.2 and §4.3](https://webmachinelearning.github.io/webmcp/#api), [Declarative API explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md), [Chrome Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)

The browser exposes tools to an agent through an implementation-defined observation. The specification does not require a particular wire format such as MCP or a particular function-calling format. WebMCP is a page-side tool surface; it does not replace a backend MCP server. [WebMCP specification, §5.2](https://webmachinelearning.github.io/webmcp/#page-observations), [WebMCP README](https://github.com/webmachinelearning/webmcp/blob/main/README.md)

## Permissions, confirmation, and security

WebMCP is gated by secure context, origin isolation, and the `tools` Permissions Policy. Chrome documents WebMCP as unavailable to documents that are not origin-isolated and states that the default policy allowlist is `self`. A site can disable the feature before page scripts run with `Permissions-Policy: tools=()`. [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp), [WebMCP specification, §4.5 and §6.4.1](https://webmachinelearning.github.io/webmcp/#permissions-policy-integration)

`consequentialHint: true` tells the client or agent that a tool has significant, real-world, or non-reversible effects. The specification describes this as a signal that can support mandatory confirmation prompts; it does not make the prompt itself a browser-enforced authorization boundary. Chrome's guidance makes the same distinction. The application must perform its own authorization and confirmation before a consequential server mutation. [WebMCP specification, §6.4.5](https://webmachinelearning.github.io/webmcp/#consequential-annotation-for-tool-executions), [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

Tool names, descriptions, parameter descriptions, and return values are agent-readable text. The specification calls out tool poisoning, output injection, ambiguous intent, and privacy leakage from over-parameterized inputs. Chrome recommends `untrustedContentHint` for user-generated or external data, `readOnlyHint` for non-mutating tools, `consequentialHint` for high-stakes tools, and short descriptions and outputs. [WebMCP specification, §6.3](https://webmachinelearning.github.io/webmcp/#key-security-and-privacy-risks), [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

For this application:

1. Keep server-side `requireOwner`, same-origin checks, revision checks, and idempotency checks in the mutation path. A WebMCP call is an untrusted request to the page, even when it runs in the user's authenticated session.
2. Expose identifiers and narrow structured inputs. Do not ask an agent to supply data that the page can derive from the active invoice, and do not return full customer records by default.
3. Treat customer names, notes, line descriptions, and external text as data. Do not place instructions in them or pass them to the agent as trusted control text. Mark tool results with `untrustedContentHint` when they contain such content.
4. Split preparation from finalization. A tool can validate or open the existing review dialog. Issuing, sending, deleting, or recording payment must still require the application's explicit user confirmation and its existing server guards.
5. Do not depend on `requestUserInteraction()` yet. Chrome's security page mentions it as an ongoing discussion, but it is not part of the current `ModelContext` interface in the draft specification. [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [current `ModelContext` IDL](https://webmachinelearning.github.io/webmcp/#modelcontext-interface)

## Accessibility and interaction

WebMCP does not replace accessible HTML. Chrome's agent-readiness guidance says agents rely on the accessibility tree as a primary data model and checks that interactive controls have programmatic names. It also checks layout stability and WebMCP tool registration and schema. The Agentic Browsing Lighthouse category is informational and unbenchmarked, so use it as a diagnostic signal rather than a release gate. [Chrome agent-ready toolkit](https://developer.chrome.com/blog/agent-ready-toolkit)

Use real labels, native controls, stable focus order, and visible status updates. Chrome's Declarative API applies `:tool-form-active` to an agent-activated form and `:tool-submit-active` to its submit button. `toolactivated` and `toolcancel` events let the page announce that an agent filled or cancelled a form. [Chrome Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)

The current WebMCP specification has an empty Accessibility considerations section. Treat normal WCAG and semantic HTML work as the accessibility contract; use WebMCP metadata to improve agent discovery, not as a substitute for it. [WebMCP specification, §7](https://webmachinelearning.github.io/webmcp/#accessibility-considerations)

## Recommended first integration

Add a small client-only registration module to the authenticated invoice editor. Feature-detect `document.modelContext`, register tools after the editor has the required invoice state, and abort registration on unmount or state change. Keep tool callbacks thin: they should call the existing client operation wrapper, update the shared query/store state, and return a compact structured result.

A safe first set is:

- `invoice.get-current-draft` — read-only; returns the active draft's identifiers, revision, totals, and validation state.
- `invoice.validate-draft` — read-only from the invoice domain; returns field-level errors and warnings without allocating an invoice number or changing durable state.
- `invoice.prepare-review` — opens or updates the existing Review state and returns `requires_user_action: true`; it does not issue or send the invoice.

Defer `invoice.issue`, `invoice.send`, `invoice.delete`, and `invoice.record-payment` until the browser-agent confirmation behavior and the application's review path are tested together. If they are exposed later, mark them consequential, show the exact target and amount in the UI, require the existing explicit confirmation, and make the server mutation idempotent and revision-checked.

Test the feature in Chrome's Origin Trial or local flag and in Edge's Origin Trial. Verify the no-WebMCP path in every supported browser. Use Chrome DevTools' WebMCP inspection and invocation tools to inspect schemas, activation, cancellation, and return payloads, then run the Agentic Browsing Lighthouse checks for programmatic names, layout stability, registered tools, and schema validity. [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp), [Chrome WebMCP debugging](https://developer.chrome.com/docs/devtools/agents/webmcp-debugging), [Chrome agent-ready toolkit](https://developer.chrome.com/blog/agent-ready-toolkit)

## Sources

- [WebMCP specification — W3C Web Machine Learning Community Group Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
- [WebMCP repository README](https://github.com/webmachinelearning/webmcp/blob/main/README.md)
- [Browser and Agent Implementation Status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
- [Declarative API explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Join the WebMCP Origin Trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial)
- [Chrome Intent to Experiment: WebMCP](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/7Rx2_OOfBAAJ)
- [A developer toolkit to make your website agent-ready](https://developer.chrome.com/blog/agent-ready-toolkit)

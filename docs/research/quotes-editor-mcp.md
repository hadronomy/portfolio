# Quotes, the page editor, and the agent surface

Research date: 11 October 2026. This file records the sources behind three decisions: what a quote (presupuesto) must contain and how a customer accepts it, which editor writes its pages, and how an agent controls the application. The implementation plan is in [the invoicing plan](../plans/invoicing.md#quotes).

## Proforma or presupuesto

They are different documents. Neither has tax effect, and neither replaces an invoice.

- A **presupuesto** is an offer. When the customer accepts it inside its validity period, it binds both sides as a contract (Código Civil, arts. 1254 and 1262). In the Canary Islands, a consumer has the right to a written presupuesto before a service, and it must state its validity period ([Ley 3/2003, art. 11.1.c](https://www.boe.es/buscar/act.php?id=BOE-A-2003-4608)). Not giving one, or giving one without the required content, is a minor infringement, fined up to 3,000 € (arts. 40.4.i and 42.1.a).
- A **proforma** has the shape of an invoice and states terms already agreed. It is used to ask for an advance payment, to fix a customs value, or to support financing ([Wolters Kluwer](https://www.wolterskluwer.com/es-es/expert-insights/factura-proforma-que-es), [Stripe](https://stripe.com/es/resources/more/pro-forma-invoices-and-quotes-in-spain)).

The application used its `proforma` kind as "a quote in invoice form". That is the job of a presupuesto. An advance payment needs an invoice of its own under the invoicing regulation, and the issuer sells services, not goods through customs. So the `proforma` kind becomes `quote`: **Presupuesto** in Spanish, **Quote** in English. "Quote" and not "estimate", because an accepted presupuesto fixes its price.

## What a quote must contain

| Rule | Applies to | Source |
| --- | --- | --- |
| Validity period stated on the document | Consumers, Canary Islands | Ley 3/2003, art. 11.1.c |
| Main characteristics, identity and address of the trader, total price **including all taxes**, payment and performance arrangements, date of performance, duration, language | Consumers | [TRLGDCU](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555) art. 60.2; art. 20.1.c for offers |
| Distance contract information: everything above, plus the withdrawal right, its period, the model form, and the customer's cost when a service started early is withdrawn | Consumers accepting online | TRLGDCU art. 97.1 |
| 14 calendar days to withdraw from a service contract, counted from the day the contract is concluded | Consumers accepting online | TRLGDCU arts. 102 and 104.a |
| Work inside the withdrawal period only on the consumer's **express request on a durable medium**; the consumer acknowledges that the right ends once the service is fully performed | Consumers | TRLGDCU arts. 98.8 and 103.a |
| A consumer who withdraws after asking for an early start pays the part already performed, in proportion to the total price | Consumers | TRLGDCU art. 108.4 |
| The model withdrawal form | Consumers accepting online | TRLGDCU art. 106.1 and annex B |
| A customer service channel that answers a complaint within one month, and official complaint forms | Traders serving consumers in the Canary Islands | Decreto 90/2023, arts. 5 and 6 ([Gobierno de Canarias](https://sede.gobiernodecanarias.org/sede/tramites/8160)) |
| No EU online dispute platform link: the platform closed on 20 July 2025 | Everyone | [Reglamento (UE) 2024/3228](https://www.boe.es/doue/2024/3228/L00001-00003.pdf) |
| Payment within 30 days unless agreed, at most 60; late interest at the ECB rate plus 8 points; 40 € recovery costs | Business customers | Ley 3/2004, arts. 4, 7 and 8 |
| Cash payments of 1,000 € or more are forbidden when one party acts as a business | Everyone | Ley 7/2012, art. 7 |
| An assignment of copyright names its rights, territory and duration; without them it is limited to what the contract needs, five years, and the country | Work with copyright | TRLPI, art. 43 |
| General conditions bind only when the customer could read them before accepting; they must be clear and simple. Abusive clauses are void against consumers | Everyone; consumers | Ley 7/1998, arts. 5 and 7; TRLGDCU arts. 82–91 |
| Information on personal data processing at collection | Everyone | RGPD art. 13; LOPDGDD art. 11 |
| Before an online contract: the steps to conclude it, whether the document is kept, how to correct errors, the language. After acceptance: a confirmation by email within 24 hours | Online acceptance | LSSI (Ley 34/2002), arts. 27 and 28 |
| A simple electronic signature is not denied legal effect | Online acceptance | eIDAS, Reglamento (UE) 910/2014, art. 25.1 |

The consolidated TRLGDCU text was last updated on 28 February 2026. Ley 3/2003 has been unchanged since 1 July 2012.

### How the application covers it

- The document prints **required notices** that the owner cannot remove. They follow from the customer type and the acceptance channel: validity, prices including IGIC for consumers, withdrawal information and the model form for consumers, the early-start request, data protection, the customer service channel, and the acceptance method.
- **Clauses** are reusable, versioned texts in both languages, each with its legal source. The owner places them in the pages. Payment terms, late payment for business customers, copyright assignment, changes to scope, and confidentiality ship as starting points.
- **Acceptance** is a simple electronic signature: the customer types their full name and agrees to the conditions on the quote page. The server records the time, the name, the email the link was sent to, the network address, the browser, and the SHA-256 digest of the exact PDF shown. It then emails a confirmation. A consumer can ask for an early start in the same step, in words that state the consequence.

This is the coverage a careful sole trader needs. It is not legal advice. A lawyer reviews the shipped clause texts before production use.

## The page editor

| Option | Assessment |
| --- | --- |
| **Tiptap 3** (3.31.4, 30 September 2026) | Headless editor on ProseMirror. Mature extensions, React bindings, a static renderer that turns JSON into React elements or Markdown without a DOM, and Markdown parsing through `@tiptap/markdown`. Chosen. |
| Lexical | Fast and good with React, but its ecosystem for tables, Markdown and server rendering is thinner, and it has no equivalent of the static renderer ([Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)). |
| ProseMirror directly | Tiptap is ProseMirror with a practical API. Direct use only pays off for a new editor framework. |
| BlockNote, Plate | Quick block UI, but they bring their own look and data model, against the rule to keep our own design system. |

Tiptap sources: [3.0 stable](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable), [static renderer](https://tiptap.dev/docs/editor/api/utilities/static-renderer), [Markdown](https://tiptap.dev/docs/editor/markdown/examples).

One extension list defines the document. The editor, the server's validation, the Markdown conversion an agent uses, and the PDF renderer all read it, so they can never disagree on what a page may hold.

Takumi supports what long-form pages need: `break-before`, `break-after` and `break-inside`, `widows` and `orphans` (default 2), repeated `<thead>` on continuation pages, internal `#id` links, and an outline built from `h1`–`h6` ([pagination](https://takumi.kane.tw/docs/pdf/pagination), [links and outline](https://takumi.kane.tw/docs/pdf/links-and-outline)).

### Interaction model

Patterns from Notion, Linear and Craft, held to [Craft](https://craft.gustavofior.com) and Emil Kowalski's rules:

- The page is the interface: an A4 sheet at real proportions, set in the PDF's own type and measure, so what the owner writes is what prints.
- `/` at the start of an empty line opens the block menu. It reacts only to a typed slash, never to pasted text, and filters as you type.
- Selecting text shows a small formatting bar above it. It appears without animation after the first time, because owners use it many times a session.
- A handle in the left margin moves a block. It shows on hover only, on devices that hover.
- Clauses are blocks with a source line. They print as written, and the owner can detach one to edit its words.
- Keyboard first: Markdown shortcuts (`#`, `-`, `1.`, `>`) and the usual mark keys. Keyboard actions never animate.

## The agent surface

- **MCP 2026-07-28** is the current revision. A remote server must publish OAuth Protected Resource Metadata (RFC 9728) and reject tokens issued for any other resource. Clients send the RFC 8707 `resource` parameter and use PKCE. Client ID Metadata Documents replace Dynamic Client Registration, which is deprecated ([client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration), [authorization draft](https://modelcontextprotocol.io/specification/draft/basic/authorization)).
- **`@better-auth/mcp` 1.7.7**, the same release as the installed better-auth, makes the existing sign-in an OAuth 2.1 authorization server for MCP clients. `cimd()` with `metadataProfile: "mcp-2026-07-28"` follows the current registration profile, and `requireMcpAuth` checks each bearer token's signature, issuer, audience and expiry. It does not carry MCP messages ([Better Auth MCP](https://better-auth.com/docs/plugins/mcp)).
- **`effect/ai/McpServer`** (Effect 4.0.0, already installed) carries them: tools from `Tool` and `Toolkit` with Schema parameters and results, resources, prompts, elicitation, and `layerHttp` for Streamable HTTP. Its tools are Effects, so they run on the application's own layer graph, services and typed errors.
- WebMCP ([earlier research](webmcp-invoice-integration.md)) stays out of scope. It only works in a page the owner has open, and an MCP server serves any agent.

The tools call the same operations the pages call, behind the same owner check. Consequential tools (issuing, recording payments, sharing links, converting an accepted quote) say so in their annotations, take idempotency keys where the store has them, and return the server's numbers instead of trusting the agent's.

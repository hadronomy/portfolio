# Notes for agents

- Invoicing app (`apps/start/src/features`, `packages/invoices`): read [the invoicing plan](docs/plans/invoicing.md) before you change it. It records what each part does and why. The sources behind those decisions are in [`docs/research`](docs/research).
- Imports never climb folders. An app imports its own modules as `~/…` (its `src/`, declared in its tsconfig.json). A package imports its own as `#…` (its package.json `imports`), because a tsconfig path would apply to every app that type-checks the package's source. Other packages are imported by name. Tests live in `test/{unit,integration,e2e}`, mirroring `src/`, with shared helpers in `test/support`.
- Database tables: edit `tables.ts`, then generate the migration with the `db:generate` script of that package. A migration that has run is history; change the schema with a new one on top.
- Words a customer, a PDF or an email says live in `packages/i18n/messages/{es,en}.json` (Paraglide JS; Spanish is the base language). Add a message to both files, then call it as `t(m.key, inputs)` with `translate(locale)` on the server or `useT()` under a `<Speak>`. Never branch on a language: plurals, dates, numbers and word order belong in the message. `messages.test.ts` holds the two files to the same keys and placeholders.

## Agents can do what the owner can

The invoices app has two front doors over one set of operations: the owner's pages, through server functions in `features/*/api.ts`, and the MCP server in `features/agent`, for agents. A capability the owner gets ships as an agent tool in the same change.

To add or change something the owner can do:

1. Put the rule in a domain service in `packages/invoices`, in a method that takes the owner's `OwnerDid` as its authority. The page and the tool both call this method, so the rule lives in one place.
2. Give the pages their way in: an arm of `Mutation` in `features/invoices/api.ts`, applied in `perform` in `operations.server.ts`, or a server function.
3. Give agents theirs:
   - a tool in `features/agent/tools.ts`, named `verb_noun`, whose description says when to use it, what it changes, and what comes back. Annotate it `Readonly`, or `Destructive` when it issues, sends, records money, or cannot be undone;
   - its handler in `handlers.server.ts`, calling the same operation as the page;
   - its entry in `coverage.ts`: `toolsForEdits` for a `Mutation` arm, `serverFunctions` for a server function.
4. A server function that only a customer or the browser uses gets `{ notForAgents: '<why>' }` in `serverFunctions` instead of a tool.

Tools take a document's number or its ID, return the server's own amounts and totals, and fail with a `ToolFailure` whose message says what to do next.

Done when `tsc` passes (it holds `toolsForEdits` complete), `coverage.test.ts` passes, and `mcp.server.test.ts` calls the new tool once for success and once for a refusal.

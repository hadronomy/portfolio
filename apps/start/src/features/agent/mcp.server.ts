import { Documents } from '@portfolio/invoices/documents';
import { InvoiceId, Language } from '@portfolio/invoices/model';
import { Context, Effect, Layer, Scope } from 'effect';
import { McpProtocol, McpSchema, McpServer } from 'effect/ai';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { appLayer, runtime } from '../../server/runtime.server';
import { invoiceToolsLayer } from './handlers.server';
import { sessionlessHandler } from './http.server';
import { InvoiceTools } from './tools';

// The workspace as an MCP server, over Streamable HTTP at /invoices/mcp.
// It runs on the app's own runtime: the memo map hands it the services the
// pages already use, so an agent and the owner share one database
// connection and see the same data.

/** What the agent is told about the workspace before it calls a tool. */
const instructions = `This is a sole trader's invoicing workspace in the Canary Islands (IGIC, not VAT). You act for its owner.

Documents are invoices, rectifying invoices and quotes (presupuestos). Each is a draft until issued; issuing gives it a number and fixes it for good. Read before you write: list_documents, then get_document, and pass back the revision it returns.

The usual flow for a project:
1. create_draft with kind "quote": the customer, the lines, the validity date, and the proposal pages in Markdown, placing clauses from list_clauses.
2. set_payment_plans if the work is paid in parts, such as a deposit and the rest on delivery.
3. issue_document, then email_quote to send it to the customer, or send_quote for a link to pass on yourself. The customer reads the quote, chooses a plan, and accepts with their name and a drawn signature.
4. Once accepted, bill_quote_payment drafts the invoice for each payment as it falls due; Spanish law asks for one invoice per payment. issue_document each one, and share_payment_link to be paid online, or record_payment for a bank transfer.

Never correct an issued invoice: start a rectifying invoice with rectify_invoice. Never change an issued quote: revise_quote starts a new version. Amounts are decimal strings in the document's currency, dates are YYYY-MM-DD. When a tool fails, its message says what to do next.`;

/** Each document's PDF, as the customer gets it, in either language. */
const pdfs =
  McpServer.resource`invoices://documents/${InvoiceId}/${Language}.pdf`({
    name: 'Document PDF',
    description:
      'The PDF of an invoice or quote exactly as the customer receives it. get_document gives the address of each one.',
    mimeType: 'application/pdf',
    content: (uri, id, language) =>
      Documents.use((documents) => documents.pdf(id, language)).pipe(
        Effect.map(({ bytes }) =>
          McpSchema.ReadResourceResult.make({
            contents: [
              McpSchema.BlobResourceContents.make({
                uri,
                mimeType: 'application/pdf',
                blob: bytes,
              }),
            ],
          }),
        ),
      ),
  });

/** The MCP server and its tools, over whichever app services it is given. */
const requestServer = Layer.mergeAll(
  McpServer.toolkit(InvoiceTools).pipe(Layer.provide(invoiceToolsLayer)),
  pdfs,
).pipe(
  Layer.provideMerge(
    McpServer.layerHttp({
      name: 'invoices',
      version: '1.0.0',
      instructions,
      description: 'Write, issue, send and get paid for invoices and quotes.',
      path: '/invoices/mcp',
      protocols: [
        McpProtocol.v2026_07_28,
        McpProtocol.v2025_11_25,
        McpProtocol.v2025_06_18,
      ],
    }),
  ),
);

/** No protocol session survives an HTTP request. */
export const agentServer = Layer.effectDiscard(
  Effect.gen(function* () {
    const services = Context.omit(
      HttpRouter.HttpRouter,
      Scope.Scope,
    )(
      yield* Effect.context<
        Exclude<Layer.Services<typeof requestServer>, HttpRouter.HttpRouter>
      >(),
    );
    const answer = sessionlessHandler(() =>
      HttpRouter.toWebHandler(
        requestServer.pipe(Layer.provide(Layer.succeedContext(services))),
        { disableLogger: true },
      ),
    );
    const router = yield* HttpRouter.HttpRouter;
    yield* router.add('*', '/invoices/mcp', (request) =>
      HttpServerRequest.toWeb(request).pipe(
        Effect.flatMap((web) => Effect.promise(() => answer(web))),
        Effect.map(HttpServerResponse.fromWeb),
      ),
    );
  }),
);

declare global {
  var invoiceAgents:
    | { readonly handler: (request: Request) => Promise<Response> }
    | undefined;
}

/** Answers one MCP request; built once per process, like the runtime. */
export const answerAgent = (request: Request) => {
  globalThis.invoiceAgents ??= HttpRouter.toWebHandler(
    agentServer.pipe(Layer.provide(appLayer)),
    {
      memoMap: runtime().memoMap,
      disableLogger: true,
    },
  );
  return globalThis.invoiceAgents.handler(request);
};

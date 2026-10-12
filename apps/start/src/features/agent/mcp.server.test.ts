import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigProvider, Layer } from 'effect';
import { HttpRouter } from 'effect/http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appLayer } from '../../server/runtime.server';
import { agentServer } from './mcp.server';
import { InvoiceTools } from './tools';

// The MCP server as an agent meets it: JSON-RPC over HTTP, against the
// app's real services on a throwaway database. The bearer-token gate in
// front of it is the auth service's; this drives what lies behind it.

const origin = 'http://127.0.0.1:4321';
let directory: string;
let handler: (request: Request) => Promise<Response>;
let dispose: () => Promise<void>;
let session = '';
let next = 1;

/** One JSON-RPC call; its reply, from JSON or from the event stream around it. */
async function rpc(method: string, params: unknown = {}) {
  const id = next++;
  const response = await handler(
    new Request(`${origin}/invoices/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
        ...(session && { 'mcp-session-id': session }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }),
  );
  session ||= response.headers.get('mcp-session-id') ?? '';
  const text = await response.text();
  // A stream may carry notifications before the reply; the reply has our id.
  const messages = text.startsWith('{')
    ? [text]
    : text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5));
  const replies = messages.map(
    (message) =>
      JSON.parse(message) as {
        id?: number;
        result?: Record<string, unknown>;
        error?: { message: string };
      },
  );
  return replies.find((reply) => reply.id === id) ?? {};
}

/** Calls a tool; its structured result, or its error text. */
async function call(name: string, args: Record<string, unknown>) {
  const reply = await rpc('tools/call', { name, arguments: args });
  const result = reply.result as {
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
    content: { text: string }[];
  };
  return result.isError
    ? { error: result.content.map((part) => part.text).join(' ') }
    : { value: result.structuredContent ?? {} };
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'invoices-mcp-'));
  const app = appLayer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          INVOICE_DATA_DIRECTORY: directory,
          NODE_ENV: 'development',
        }),
      ),
    ),
  );
  const web = HttpRouter.toWebHandler(agentServer.pipe(Layer.provide(app)), {
    disableLogger: true,
  });
  handler = web.handler;
  dispose = web.dispose;
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  });
  await rpc('notifications/initialized');
}, 60_000);

afterAll(async () => {
  await dispose();
  await rm(directory, { recursive: true, force: true });
});

describe('the MCP server', () => {
  it('lists every tool, with the hints a client shows the owner', async () => {
    const reply = await rpc('tools/list');
    const tools = reply.result?.tools as {
      name: string;
      annotations?: Record<string, boolean>;
    }[];
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      Object.keys(InvoiceTools.tools).sort(),
    );
    const hints = Object.fromEntries(
      tools.map((tool) => [tool.name, tool.annotations]),
    );
    expect(hints.list_documents?.readOnlyHint).toBe(true);
    expect(hints.delete_draft?.destructiveHint).toBe(true);
    expect(hints.create_draft?.destructiveHint).toBe(false);
  });

  it('writes a quote with pages and clauses, then reads it back', async () => {
    const created = await call('create_draft', {
      kind: 'quote',
      changes: {
        title: 'Booking redesign',
        lines: [{ description: 'Discovery', unitPrice: '850.00' }],
        pages:
          '# The proposal\n\nTwo phases.\n\n::page-break\n\n::clause[scope@1]',
      },
    });
    const document = (created.value?.document ?? {}) as {
      id: string;
      kind: string;
      status: string;
    };
    expect(document).toMatchObject({ kind: 'quote', status: 'draft' });
    const read = await call('get_document', { document: document.id });
    const detail = read.value as {
      pages: string;
      totals: { total: string };
      issueBlockers: unknown[];
      revision: number;
    };
    expect(detail.pages).toContain('::clause[scope@1]');
    expect(detail.pages).toContain('::page-break');
    expect(detail.totals.total).toBe('909.50');
    // No customer yet, so the draft says what it still needs.
    expect(detail.issueBlockers.length).toBeGreaterThan(0);

    const pdf = await rpc('resources/read', {
      uri: (read.value as { pdf: string }).pdf,
    });
    const [contents] = (pdf.result?.contents ?? []) as {
      mimeType: string;
      blob: string;
    }[];
    expect(contents?.mimeType).toBe('application/pdf');
    expect(
      Buffer.from(contents?.blob ?? '', 'base64')
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

    const listed = await call('list_documents', { kind: 'quote' });
    expect(
      (listed.value?.documents as { id: string }[]).map((row) => row.id),
    ).toContain(document.id);
  });

  it('answers a stale revision and an unknown document with what to do next', async () => {
    const created = await call('create_draft', { kind: 'invoice' });
    const { id } = created.value?.document as { id: string };
    const stale = await call('update_draft', {
      document: id,
      revision: 99,
      changes: { title: 'Late' },
    });
    expect(stale.error).toMatch(/get_document/);
    const missing = await call('get_document', { document: 'INV-1999-0001' });
    expect(missing.error).toMatch(/list_documents/);
  });

  it('refuses pages on an invoice, and unreadable pages on a quote', async () => {
    const invoice = await call('create_draft', {
      kind: 'invoice',
      changes: { pages: '# Nope' },
    });
    expect(invoice.error).toMatch(/Only a quote/);
    const quote = await call('create_draft', {
      kind: 'quote',
      changes: { pages: '::clause[no-such-clause@1]' },
    });
    expect(quote.error).toMatch(/pages cannot be read/);
  });

  it('emails an issued quote to its customer, and refuses a draft', async () => {
    const settings = (await call('get_settings', {})).value as {
      preferences: Record<string, unknown> & { issuer: object };
    };
    const address = {
      lines: 'Calle Mayor, 1',
      dependentLocality: '',
      locality: 'Santa Cruz de Tenerife',
      region: 'Santa Cruz de Tenerife',
      postalCode: '38001',
      sortingCode: '',
      country: 'ES',
    };
    await call('save_settings', {
      preferences: {
        ...settings.preferences,
        issuer: {
          ...settings.preferences.issuer,
          name: 'Estudio Ejemplo',
          taxId: '12345678Z',
          email: 'hola@estudio.test',
          address,
        },
      },
    });
    const saved = await call('save_customer', {
      customer: {
        name: 'Lucía Martín',
        taxId: '87654321X',
        email: 'lucia@example.test',
        address,
        type: 'consumer',
        territory: 'canary-islands',
        language: 'es',
      },
    });
    const customer = (saved.value as { customer: { id: string } }).customer;
    const created = await call('create_draft', {
      kind: 'quote',
      changes: {
        title: 'Rediseño',
        customer: customer.id,
        lines: [{ description: 'Diseño', unitPrice: '850.00' }],
      },
    });
    const draft = (created.value as { document: { id: string } }).document;

    const refused = await call('email_quote', { document: draft.id });
    expect(refused.error).toMatch(/Issue the quote first/);

    const read = await call('get_document', { document: draft.id });
    const issued = await call('issue_document', {
      document: draft.id,
      revision: (read.value as { revision: number }).revision,
    });
    expect(issued.error).toBeUndefined();
    const sent = await call('email_quote', {
      document: draft.id,
      note: 'Hola, Lucía: aquí tienes el presupuesto.',
    });
    expect(sent.value).toMatchObject({ to: 'lucia@example.test' });
    const after = await call('get_document', { document: draft.id });
    expect(after.value).toMatchObject({
      openLinks: 1,
      emails: [{ to: 'lucia@example.test' }],
    });
  });
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigProvider, Layer } from 'effect';
import { McpProtocol } from 'effect/ai';
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
let app: Layer.Layer<
  Layer.Success<typeof appLayer>,
  Layer.Error<typeof appLayer>
>;
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
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        ...(method.startsWith('notifications/') ? {} : { id }),
        method,
        params,
      }),
    }),
  );
  expect([200, 202]).toContain(response.status);
  expect(response.headers.has('mcp-session-id')).toBe(false);
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
  app = appLayer.pipe(
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
  for (const protocol of [
    McpProtocol.v2026_07_28,
    McpProtocol.v2025_11_25,
    McpProtocol.v2025_06_18,
  ]) {
    it(`${protocol.protocolVersion} works across cold handlers`, async () => {
      const coldDirectory = await mkdtemp(join(tmpdir(), 'invoices-mcp-cold-'));
      const coldApp = appLayer.pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              INVOICE_DATA_DIRECTORY: coldDirectory,
              NODE_ENV: 'development',
            }),
          ),
        ),
      );
      const first = HttpRouter.toWebHandler(
        agentServer.pipe(Layer.provide(coldApp)),
        {
          disableLogger: true,
        },
      );
      let second: typeof first | undefined;
      const modern = protocol.protocolVersion === '2026-07-28';
      const send = async (
        target: typeof first,
        method: string,
        params: Record<string, unknown> = {},
        id: number | null = next++,
      ) => {
        const response = await target.handler(
          new Request(`${origin}/invoices/mcp`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              'mcp-protocol-version': protocol.protocolVersion,
              ...(modern && {
                'mcp-method': method,
                ...(typeof params.name === 'string' && {
                  'mcp-name': params.name,
                }),
              }),
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              ...(id === null ? {} : { id }),
              method,
              params: {
                ...params,
                ...(modern && {
                  _meta: {
                    'io.modelcontextprotocol/protocolVersion':
                      protocol.protocolVersion,
                    'io.modelcontextprotocol/clientCapabilities': {},
                  },
                }),
              },
            }),
          }),
        );
        expect(response.headers.has('mcp-session-id')).toBe(false);
        return response;
      };
      try {
        // MCP 2026 removed initialize; discovery carries its server capabilities.
        const initialized = await send(
          first,
          modern ? 'server/discover' : 'initialize',
          modern
            ? {}
            : {
                protocolVersion: protocol.protocolVersion,
                capabilities: { roots: {}, sampling: {} },
                clientInfo: { name: 'cold-client', version: '1' },
              },
        );
        expect(initialized.status).toBe(200);
        const initialization = await initialized.json();
        expect(initialization.result.capabilities.tools.listChanged).toBe(
          false,
        );
        expect(initialization.result.capabilities.resources.subscribe).toBe(
          false,
        );
        expect(initialization.result.capabilities.logging).toBeUndefined();
        if (!modern) {
          expect(initialization.result.protocolVersion).toBe(
            protocol.protocolVersion,
          );
        }
        // Close the first runtime before the client reaches another instance.
        await first.dispose();
        second = HttpRouter.toWebHandler(
          agentServer.pipe(Layer.provide(coldApp)),
          {
            disableLogger: true,
          },
        );
        if (!modern) {
          const notified = await send(
            second,
            'notifications/initialized',
            {},
            null,
          );
          expect(notified.status).toBe(202);
          expect(await notified.text()).toBe('');
        }
        const listed = await send(second, 'tools/list');
        expect(listed.status).toBe(200);
        expect(
          (await listed.json()).result.tools
            .map((tool: { name: string }) => tool.name)
            .sort(),
        ).toEqual(Object.keys(InvoiceTools.tools).sort());
        const called = await send(second, 'tools/call', {
          name: 'list_documents',
          arguments: {},
        });
        expect(called.status).toBe(200);
        expect((await called.json()).result).toMatchObject({
          structuredContent: { documents: [], more: 0 },
        });
        const get = await second.handler(
          new Request(`${origin}/invoices/mcp`, {
            headers: {
              accept: 'text/event-stream',
              'mcp-protocol-version': protocol.protocolVersion,
            },
          }),
        );
        expect(get.status).toBe(405);
        expect(get.headers.get('allow')).toBe('POST');
        await get.text();
        const logLevel = await send(second, 'logging/setLevel', {
          level: 'debug',
        });
        expect((await logLevel.json()).error.code).toBe(-32601);
        if (modern) {
          const subscriptions = await send(second, 'subscriptions/listen', {});
          expect((await subscriptions.json()).error.code).toBe(-32601);
        } else {
          const subscribed = await send(second, 'resources/subscribe', {
            uri: 'invoices://documents/test/en.pdf',
          });
          expect((await subscribed.json()).error.code).toBe(-32601);
        }
      } finally {
        await first.dispose();
        await second?.dispose();
        await rm(coldDirectory, { recursive: true, force: true });
      }
    }, 60_000);
  }

  it.each([
    [{ origin: 'https://untrusted.test' }, 403],
    [{ accept: 'application/json' }, 406],
    [{ 'content-type': 'text/plain' }, 415],
    [{ 'mcp-protocol-version': '1999-01-01' }, 400],
    [{ 'mcp-protocol-version': '' }, 400],
    [{ 'mcp-session-id': 'unknown' }, 404],
    [{ accept: 'application/json, text/event-stream;q=0' }, 406],
    [{ 'content-type': 'application/json;q=0' }, 415],
  ])('preserves transport validation for %j', async (overrides, status) => {
    for (const method of [
      'tools/list',
      'logging/setLevel',
      'subscriptions/listen',
    ]) {
      const response = await handler(
        new Request(`${origin}/invoices/mcp`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': '2025-06-18',
            ...overrides,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: next++,
            method,
            params: { level: 'debug' },
          }),
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.has('mcp-session-id')).toBe(false);
      await response.text();
    }
  });

  it('keeps modern header validation before persistent-operation refusals', async () => {
    const response = await handler(
      new Request(`${origin}/invoices/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2026-07-28',
          'mcp-method': 'tools/list',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: next++,
          method: 'subscriptions/listen',
          params: {
            _meta: {
              'io.modelcontextprotocol/protocolVersion': '2026-07-28',
              'io.modelcontextprotocol/clientCapabilities': {},
            },
          },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toMatch(/Mcp-Method/);
  });

  it.each([
    [{}, {}, 404],
    [{ origin: 'https://untrusted.test' }, {}, 403],
    [{ accept: 'application/json' }, {}, 406],
    [{ 'content-type': 'text/plain' }, {}, 415],
    [{ 'mcp-method': '' }, {}, 400],
    [{ 'mcp-protocol-version': '2025-11-25' }, {}, 400],
    [{}, { 'io.modelcontextprotocol/protocolVersion': null }, 400],
    [{}, { 'io.modelcontextprotocol/clientCapabilities': null }, 400],
  ])('keeps modern refusal checks for %j and %j', async (headers, metadata, status) => {
    for (const method of ['logging/setLevel', 'subscriptions/listen']) {
      const response = await handler(
        new Request(`${origin}/invoices/mcp`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': '2026-07-28',
            'mcp-method': method,
            ...headers,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: next++,
            method,
            params: {
              level: 'debug',
              _meta: {
                'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientCapabilities': {},
                ...metadata,
              },
            },
          }),
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.has('mcp-session-id')).toBe(false);
      if (status === 404) {
        expect((await response.json()).error).toEqual({
          code: -32601,
          message: `Method not found: ${method}`,
        });
      } else {
        await response.text();
      }
    }
  });

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

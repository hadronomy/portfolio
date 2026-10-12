import { Schema } from 'effect';

const sessionProtocolVersions = ['2025-11-25', '2025-06-18'];
const requestMessage = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  method: Schema.String,
  params: Schema.optional(Schema.JsonObject),
});
type RequestMessage = typeof requestMessage.Type;
type HttpHandler = (request: Request) => Promise<Response>;

const decodeMessage = Schema.decodeUnknownOption(
  Schema.fromJsonString(requestMessage),
);
const decodeObject = Schema.decodeUnknownOption(Schema.JsonObject);
const decodeReply = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.JsonObject),
);

async function initializeRequestSession(
  handler: HttpHandler,
  request: Request,
  headers: Headers,
  message: RequestMessage | undefined,
) {
  const version = headers.get('mcp-protocol-version');
  if (
    !message ||
    message.method === 'initialize' ||
    headers.has('mcp-session-id') ||
    !sessionProtocolVersions.includes(version ?? '')
  )
    return;

  // Effect requires a session for 2025 requests, even when the public transport has none.
  const response = await handler(
    new Request(request.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: version,
          capabilities: {},
          clientInfo: { name: 'http', version: '1' },
        },
      }),
      signal: request.signal,
    }),
  );
  await response.arrayBuffer();
  const session = response.headers.get('mcp-session-id');
  if (session) headers.set('mcp-session-id', session);
}

function mediaTypes(header: string | null): string[] {
  return (header ?? '').split(',').flatMap((part) => {
    const [type = '', ...parameters] = part.split(';');
    const quality = parameters
      .map((parameter) => parameter.trim().toLowerCase())
      .find((parameter) => parameter.startsWith('q='));
    if (quality !== undefined) {
      const value = Number(quality.slice(2));
      if (!Number.isFinite(value) || value <= 0 || value > 1) return [];
    }
    return [type.trim().toLowerCase()];
  });
}

function hasModernRoutingHeaders(headers: Headers, message: RequestMessage) {
  const metadata = decodeObject(message.params?._meta);
  return (
    metadata._tag === 'Some' &&
    metadata.value['io.modelcontextprotocol/protocolVersion'] ===
      '2026-07-28' &&
    decodeObject(metadata.value['io.modelcontextprotocol/clientCapabilities'])
      ._tag === 'Some' &&
    headers.get('mcp-method') === message.method
  );
}

function canRefuseBeforeDispatch(
  request: Request,
  headers: Headers,
  message: RequestMessage,
) {
  // Keep these checks aligned with Effect's private McpServer HTTP checks and
  // mcpRuntime.selectHttpProtocol. Effect answers every request that fails them.
  const accepted = mediaTypes(headers.get('accept'));
  if (
    headers.has('origin') ||
    mediaTypes(headers.get('content-type'))[0] !== 'application/json' ||
    !accepted.includes('application/json') ||
    !accepted.includes('text/event-stream')
  )
    return false;

  const version = headers.get('mcp-protocol-version');
  if (version === '2026-07-28')
    return hasModernRoutingHeaders(headers, message);

  const metadata = decodeObject(message.params?._meta);
  return (
    sessionProtocolVersions.includes(version ?? '') &&
    !request.headers.has('mcp-session-id') &&
    headers.has('mcp-session-id') &&
    !(
      metadata._tag === 'Some' &&
      'io.modelcontextprotocol/protocolVersion' in metadata.value
    )
  );
}

function refusePersistentMethod(
  request: Request,
  headers: Headers,
  message: RequestMessage | undefined,
): Response | undefined {
  if (
    !message ||
    (message.method !== 'subscriptions/listen' &&
      message.method !== 'logging/setLevel') ||
    !canRefuseBeforeDispatch(request, headers, message)
  )
    return;

  const modern = headers.get('mcp-protocol-version') === '2026-07-28';
  if (!modern && message.id === undefined)
    return new Response(null, { status: 202 });
  return Response.json(
    {
      jsonrpc: '2.0',
      id: message.id ?? null,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    },
    { status: modern ? 404 : 200 },
  );
}

function replyFromEventStream(body: string, id: RequestMessage['id']): string {
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const reply = decodeReply(line.slice(5));
    if (
      reply._tag === 'Some' &&
      reply.value.id === id &&
      ('result' in reply.value || 'error' in reply.value)
    )
      return JSON.stringify(reply.value);
  }
  // A completed Effect response to an RPC request must contain its reply.
  throw new Error('The MCP response stream has no reply.');
}

function withoutNotificationCapabilities(
  reply: Schema.JsonObject,
): Schema.JsonObject {
  const decoded = decodeObject(reply.result);
  if (decoded._tag === 'None') return reply;
  const result = decoded.value;
  const capabilities = decodeObject(result.capabilities);
  if (capabilities._tag === 'None') return reply;
  const { logging: _logging, ...rest } = capabilities.value;
  const supported: Record<string, Schema.Json> = { ...rest };
  for (const name of ['tools', 'resources', 'prompts']) {
    const capability = decodeObject(supported[name]);
    if (capability._tag === 'Some')
      supported[name] = {
        ...capability.value,
        listChanged: false,
        ...(name === 'resources' && { subscribe: false }),
      };
  }
  return { ...reply, result: { ...result, capabilities: supported } };
}

async function finiteResponse(
  response: Response,
  message: RequestMessage | undefined,
) {
  const headers = new Headers(response.headers);
  headers.delete('mcp-session-id');
  headers.delete('content-length');
  let body = await response.text();
  if (headers.get('content-type')?.startsWith('text/event-stream')) {
    body = replyFromEventStream(body, message?.id);
    headers.set('content-type', 'application/json');
  }
  if (
    response.ok &&
    (message?.method === 'initialize' || message?.method === 'server/discover')
  ) {
    const reply = decodeReply(body);
    if (reply._tag === 'Some')
      body = JSON.stringify(withoutNotificationCapabilities(reply.value));
  }
  return new Response(body || null, { status: response.status, headers });
}

/** Each request owns its Effect session; application services remain shared. */
export function sessionlessHandler(
  build: () => {
    readonly handler: HttpHandler;
    readonly dispose: () => Promise<void>;
  },
): HttpHandler {
  return async (request) => {
    const web = build();
    try {
      const body = request.method === 'POST' ? await request.text() : '';
      const decoded = decodeMessage(body);
      const message = decoded._tag === 'Some' ? decoded.value : undefined;
      const headers = new Headers(request.headers);
      await initializeRequestSession(web.handler, request, headers, message);
      const response =
        refusePersistentMethod(request, headers, message) ??
        (await web.handler(
          new Request(request.url, {
            method: request.method,
            headers,
            ...(request.method === 'POST' && { body }),
            signal: request.signal,
          }),
        ));
      return await finiteResponse(response, message);
    } finally {
      await web.dispose();
    }
  };
}

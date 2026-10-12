import { Schema } from 'effect';

const legacyVersions = ['2025-11-25', '2025-06-18'];
const requestMessage = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  method: Schema.String,
  params: Schema.optional(Schema.JsonObject),
});
const decodeMessage = Schema.decodeUnknownOption(
  Schema.fromJsonString(requestMessage),
);
const decodeObject = Schema.decodeUnknownOption(Schema.JsonObject);
const decodeReply = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.JsonObject),
);

/** HTTP has no persistent streams, subscriptions, or client log level. */
function withoutNotifications(reply: Schema.JsonObject): Schema.JsonObject {
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

/**
 * Effect's legacy HTTP sessions are private in-memory maps. Give each POST
 * its own runtime so no later request needs them. Application services remain
 * shared within the instance; records and authorization live in PostgreSQL.
 */
export function sessionlessHandler(
  build: () => {
    readonly handler: (request: Request) => Promise<Response>;
    readonly dispose: () => Promise<void>;
  },
) {
  return async (request: Request): Promise<Response> => {
    const web = build();
    try {
      const text = request.method === 'POST' ? await request.text() : '';
      const parsed = decodeMessage(text);
      const message = parsed._tag === 'Some' ? parsed.value : undefined;
      const headers = new Headers(request.headers);
      const version = headers.get('mcp-protocol-version');
      // Only finite replies work across independent serverless instances.
      // Keep Effect's Origin and media-type checks in front of the refusal.
      const unavailable =
        message?.method === 'subscriptions/listen' ||
        message?.method === 'logging/setLevel';
      if (
        message &&
        message.method !== 'initialize' &&
        !headers.has('mcp-session-id') &&
        legacyVersions.includes(version ?? '')
      ) {
        const initialize = await web.handler(
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
          }),
        );
        await initialize.arrayBuffer();
        const session = initialize.headers.get('mcp-session-id');
        if (session) headers.set('mcp-session-id', session);
      }
      if (unavailable && headers.get('mcp-method') === message?.method) {
        headers.set('mcp-method', 'unsupported');
      }
      const response = await web.handler(
        new Request(request.url, {
          method: request.method,
          headers,
          ...(request.method === 'POST' && {
            body: unavailable
              ? JSON.stringify({ ...message, method: 'unsupported' })
              : text,
          }),
          signal: request.signal,
        }),
      );
      const outgoing = new Headers(response.headers);
      outgoing.delete('mcp-session-id');
      outgoing.delete('content-length');
      let body = await response.text();
      if (outgoing.get('content-type')?.startsWith('text/event-stream')) {
        const replies = body
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => decodeReply(line.slice(5)))
          .flatMap((reply) => (reply._tag === 'Some' ? [reply.value] : []));
        const reply = replies.find(
          (reply) =>
            reply.id === message?.id && ('result' in reply || 'error' in reply),
        );
        if (!reply) throw new Error('The MCP response stream has no reply.');
        body = JSON.stringify(reply);
        outgoing.set('content-type', 'application/json');
      }
      if (
        body.length > 0 &&
        ((response.ok &&
          (message?.method === 'initialize' ||
            message?.method === 'server/discover')) ||
          unavailable)
      ) {
        const reply = Schema.decodeUnknownSync(Schema.JsonObject)(
          JSON.parse(body),
        );
        const decodedError = decodeObject(reply.error);
        const result =
          unavailable &&
          decodedError._tag === 'Some' &&
          decodedError.value.code === -32601
            ? {
                ...reply,
                error: {
                  ...decodedError.value,
                  message: `Method not found: ${message?.method}`,
                },
              }
            : withoutNotifications(reply);
        body = JSON.stringify(result);
      }
      return new Response(body || null, {
        status: response.status,
        headers: outgoing,
      });
    } finally {
      await web.dispose();
    }
  };
}

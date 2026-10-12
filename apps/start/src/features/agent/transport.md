# MCP over serverless HTTP

The endpoint supports 2026-07-28, 2025-11-25, and 2025-06-18 without public session IDs. Each request can reach a new instance.

Both 2025 transport specifications make a session ID optional. They permit JSON replies and a 405 response to GET. Clients send the negotiated protocol version on each later request. These rules permit this server to retain no client state between requests. Sources: [2025-06-18 transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#session-management) and [2025-11-25 transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management).

The [2026-07-28 transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) removes initialization, protocol sessions, and GET streams. Each request carries its version and client capabilities. Its cold-instance test uses `server/discover` in place of `initialize`.

## Effect 4.0.0

The inspected sources live under `effect/src/ai` in the installed package:

- `McpServer.ts`: `layerHttp` always creates its own runtime. Its options expose neither a stateless mode for 2025 nor a session store.
- `McpProtocol.ts` and `internal/mcpProtocol/v2025_*.ts`: both 2025 adapters declare a stateful runtime. Their codecs and handlers retain each dated protocol's wire format.
- `internal/mcpRuntime.ts`: initialization creates a UUID and stores the negotiated profile. The runtime permits at most one stateless adapter, so changing the two legacy runtime descriptors cannot solve this endpoint.
- `internal/mcpStatefulRuntime.ts`: private maps hold the initialization payload, version, client capabilities, client information, initialization metadata, adapter, and log level. Resource subscriptions use a set when enabled. HTTP disables these subscriptions.
- The initialized-client set is separate from the HTTP session map. Request IDs, pending reverse calls, notification recipients, and POST response streams also live in memory. GET streams and stream resumption are absent from Effect's HTTP layer.

A database store is not an exposed integration point. Storing profiles alone also cannot share pending reverse calls or live streams.

## Adaptation

`http.server.ts` wraps a fresh Effect HTTP handler for each request. It retains Effect's dated decoding, result projection, tool errors, Origin checks, media-type checks, and modern header validation.

For a later 2025 request, the wrapper initializes only that request's internal handler with the version from its header. It supplies no client capabilities. The invoice tools do not use sampling, elicitation, or roots. The wrapper forwards the request with the internal session ID and consumes its finite response. It removes notification frames and the session header, then disposes the handler. No internal session survives the request.

Initialization and discovery advertise no logging, list changes, or resource subscriptions. Persistent log-level and subscription requests return method-not-found. GET and DELETE return 405. Client notifications receive 202. Cancellation is best effort and does not locate requests on another instance. There are no resumable streams or server-initiated messages.

Application services stay shared within an instance. Tool operations read and write PostgreSQL through the existing domain services. Authorization reads the owner and consent from PostgreSQL on every request. The global handler cache affects reuse, not correctness.

This approach uses the permitted sessionless transport behavior through a narrow adaptation. It adds no database tables or dependencies. The cost is a transport runtime and an internal legacy handshake for each request.

## Verification

The integration tests create independent handler runtimes and close the first before the second receives requests. Each version completes initialization or discovery, tool discovery, and a real tool call. They also check absent session headers, notification capabilities, GET refusal, and persistent-operation refusal. Existing tool success and refusal tests still exercise the same endpoint.

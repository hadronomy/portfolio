# MCP over serverless HTTP

The endpoint supports 2026-07-28, 2025-11-25, and 2025-06-18 without public session IDs. Consecutive requests can reach different cold instances.

Effect 4 keeps its 2025 sessions in private memory and exposes no session store or sessionless option. Both [2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#session-management) and [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management) permit sessionless HTTP with JSON replies. The [2026-07-28 transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) removes protocol sessions and initialization.

## Adaptation

`http.server.ts` builds a fresh Effect HTTP handler for each request. For later 2025 requests, it creates an internal session with a synthetic `initialize` and forwards the request with that session ID. It refuses persistent methods, consumes the finite response, removes notification frames and the session header, and disposes the handler. Initialization and discovery advertise no logging, list changes, or resource subscriptions.

Effect retains protocol decoding, result projection, and tool errors. Its HTTP validators are private. Direct refusals repeat the Origin, media-type, and protocol-header checks from `effect/src/ai/McpServer.ts` and `internal/mcpRuntime.ts`. Requests that fail these checks reach Effect unchanged, so Effect supplies the transport error. These checks must stay aligned with the installed Effect version.

Application services remain shared within an instance. Authorization and tool operations read PostgreSQL on each request. Internal 2025 initialization supplies no client capabilities because invoice tools use no sampling, elicitation, or roots.

## Unsupported operations and cost

`subscriptions/listen` and `logging/setLevel` return method-not-found. A successful [2025 log-level request](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging#setting-log-level) promises a client setting that this request runtime cannot retain. The [2026 logging feature](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/logging) instead uses per-request metadata. This endpoint emits no log notifications.

GET and DELETE return 405. Client notifications receive 202. There are no persistent subscriptions, resumable streams, or server-initiated messages. Cancellation cannot locate a request on another instance.

Each request adds a transport runtime. Later 2025 requests also add an internal handshake. The adapter adds no database tables or dependencies.

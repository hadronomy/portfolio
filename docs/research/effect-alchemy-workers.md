# Effect and Alchemy payments Worker

Research date: **2026-10-05**. This is an October 5 snapshot, not a forecast for the rest of October. Code sketches show proposed composition. They are not compiled implementations.

**Recommendation:** Add `apps/payments`. Use Alchemy **2.0.0-beta.80**, its Effect-native Worker bridge, and the repo's Effect **4.0.0**. Verify the raw Stripe webhook, await a Queue write, then return `200`. Consume the job through `Collection.settle`. Use Cron scans over PostgreSQL for reconciliation and instalment reminders. Use Hyperdrive with event-scoped database clients. This combines Alchemy's implemented bindings with durable Queue delivery and the repo's existing settlement and payment-plan rules. [Alchemy release][A1], [Worker bridge][A2], [Queue guarantees][C1], [collection](../../packages/invoices/src/collection.ts), [plan](../../packages/invoices/src/plan.ts).

Two corrections guide the implementation. Effect 4.0.0 final exports `effect/http/*` and `effect/http-api/*`. The beta's `effect/unstable/*` paths are absent. Also, `@effect/sql-pg` v4 has its own PostgreSQL protocol client. It does not wrap `pg`. [Effect exports][E1], [PgClient][E2].

## 1. Alchemy version, bindings, development, and state

**Recommendation:** Use the main `alchemy` package. Its latest published release on this date is `2.0.0-beta.80`, published October 2. It declares `effect: ^4.0.0`. The Effect API is already the main API. `alchemy-effect@0.12.0` remains on npm from April 13, with beta-era dependencies. Its GitHub repository redirects to `alchemy-run/alchemy`. The npm registry returns `404` for `@alchemy.run/effect`. Use neither package name for new work. [Release metadata][A1], [old package][A3], [repository redirect][A4], [scoped package lookup][A5].

This API is implemented and has Worker integration examples. Alchemy itself is still a beta. Adopt it with a fixed version and deployment tests. This is an engineering recommendation, not a stable-release claim. [Worker example][A6], [Hyperdrive integration tests][A7], [release metadata][A1].

```ts
// apps/payments/alchemy.run.ts
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import PaymentsWorker from "./src/worker.ts";

export default Alchemy.Stack(
  "Payments",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const worker = yield* PaymentsWorker;
    return { url: worker.url.as<string>() };
  }),
);
```

The release examples use this Stack shape and one `alchemy.run.ts` per example app. Use one stack in `apps/payments` now. Keep shared resource declarations in modules. A stack per app is a repo layout choice, not an Alchemy requirement. [Example stack][A8].

| Need | Exact v2 API or property | Runtime use |
| --- | --- | --- |
| Worker | `Cloudflare.Worker("Payments", { main: import.meta.url }, construction)` | Construction returns `{ fetch: Effect }` and can register event listeners. [A6] |
| Secrets | Yield `Config.Redacted("STRIPE_SECRET_KEY")` during construction. Plain async Workers use `env: { STRIPE_SECRET_KEY: Config.Redacted(...) }`. | The bridge supplies a Worker ConfigProvider. Worker-only reads inside `fetch` do not discover bindings during deployment. [A9] |
| Hyperdrive | `Cloudflare.Hyperdrive.Connection("Database", { origin, caching: { disabled: true } })` | `Cloudflare.Hyperdrive.Connect(connection)`, with `Cloudflare.Hyperdrive.ConnectBinding`. `connectionString` is an Effect of a redacted URL. [A10] |
| Queue | `Cloudflare.Queues.Queue("Jobs")` | `Cloudflare.Queues.WriteQueue(queue)` plus `WriteQueueBinding`. `consumeQueueMessages(queue, props, handler)` plus `EventSourceLive` creates the consumer. [A11] |
| Durable Object | `Cloudflare.DurableObject<InvoiceTimer>()("InvoiceTimer", construction)` | Yield the declaration in the Worker. Use `Cloudflare.DurableObjectState` in its implementation. Async classes use `env` with `{ className }`. [A6], [A8] |
| Cron | `Cloudflare.Workers.cron("*/5 * * * *", handler)` plus `CronEventSourceLive` | Receives a `ScheduledController`. Plain async Workers declare `crons: [...]` and export `scheduled`. [A12] |
| Workflow | `Cloudflare.Workflow<Reminder>()("Reminder", construction)` | Yield it in the Worker and call `create`. Use `Cloudflare.Workflows.task`, `sleepUntil`, and `waitForEvent`. Plain async references specify `className` in `Cloudflare.Workflow`. [A13] |

Use `alchemy dev` for local work. Current Alchemy runs Workers in **workerd**, with its own binding simulators. Do not describe this release as a Miniflare wrapper. It provides a Miniflare-compatible manual Cron route: `/cdn-cgi/handler/scheduled`. Hyperdrive development needs a reachable PostgreSQL origin. It does not simulate PostgreSQL. [Local development][A14], [Hyperdrive example][A15].

```sh
# From apps/payments, after dependency installation with bun:
node ./node_modules/alchemy/bin/cli.js dev
node ./node_modules/alchemy/bin/cli.js plan --stage prod
node ./node_modules/alchemy/bin/cli.js deploy --stage prod
stripe listen --forward-to localhost:1337/invoices/stripe/webhook
```

These direct CLI paths assume `alchemy` is installed in that app's `node_modules`. A package script can use `node` with the resolved package path. The CLI supports Node **22.15+**, **23.5+**, or **24+**. Its launcher chooses Bun under a Bun invocation. Therefore, the root's `node >=22.12.0` minimum is too low for this CLI. Use Node 24 for infrastructure commands and keep Bun as the package manager. [CLI launcher][A16], [Stripe CLI forwarding][S1], [root manifest](../../package.json).

Use `Cloudflare.state()` for production and CI. It creates a state Worker with a SQLite Durable Object. Secrets Store holds its authentication token and encryption key. Its first bootstrap can create cloud resources even during `dev` or `plan`. Use `Alchemy.localState()` for wholly local experiments. State is separate from invoice data. [State implementation and guide][A17].

## 2. Effect v4 handlers and runtime lifetime

**Recommendation:** Let Alchemy own the Worker runtime. Its bridge builds the application Layers once per isolate. Each event gets a fresh Scope and execution context. Finalizers close through `ctx.waitUntil`. Keep database resources inside that event Scope. Do not add a second isolate-wide ManagedRuntime around Alchemy's bridge. [Bridge source][A2], [execution memo][A18].

This sketch shows the event APIs. `makeHandlers` is a proposed application constructor. It must build and capture the shared services without opening database connections during deployment.

```ts
// apps/payments/src/worker.ts
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Stream } from "effect";
import { makeHandlers, type PaymentJob } from "./handlers.ts";

export default Cloudflare.Worker(
  "Payments",
  {
    main: import.meta.url,
    compatibility: { date: "2026-10-05" },
  },
  Effect.gen(function* () {
    const jobs = yield* Cloudflare.Queues.Queue("Jobs");
    const writer = yield* Cloudflare.Queues.WriteQueue(jobs);
    const handlers = yield* makeHandlers(writer);

    yield* Cloudflare.Queues.consumeQueueMessages<PaymentJob>(
      jobs,
      { batchSize: 1, maxConcurrency: 1, maxRetries: 10, retryDelay: "1 minute" },
      (messages) => Stream.runForEach(messages, (message) =>
        handlers.consume(message.body)),
    );
    yield* Cloudflare.Workers.cron("*/5 * * * *", (controller) =>
      handlers.scan(controller.scheduledTime).pipe(
        Effect.tapCause((cause) => Effect.logError("Payments scan failed", cause)),
      ));
    return { fetch: handlers.webhook };
  }).pipe(Effect.provide([
    Cloudflare.Queues.WriteQueueBinding,
    Cloudflare.Queues.EventSourceLive,
    Cloudflare.Workers.CronEventSourceLive,
  ])),
);
```

The Queue listener retries failed batches. Add a separate Queue and set `deadLetterQueue` to its **physical queue name**, with a stage-specific name. A batch size of one bounds replay work initially. Increase it after measurement. Decode every message with Schema. A TypeScript generic does not verify the payload. Alchemy's Cron listener catches failures, so emit failure logs and persist scan progress. [Queue event source][A11], [Cron source][A12], [Queue retry rules][C2].

For compatibility dates from **2026-08-04**, Workers enables Node compatibility by default. Omit redundant `nodejs_compat` flags in new configurations. Dates from 2024-09-23 through 2026-08-03 need the explicit flag. [Node compatibility][C14].

Exact imports in Effect **4.0.0 final** are:

```ts
import { Config, ConfigProvider, Context, Effect, Layer, ManagedRuntime } from "effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
```

For this raw webhook, use `HttpRouter`. `HttpApi` helps with typed internal payment operations later. `HttpRouter.toHttpEffect(routes)` fits Alchemy's `{ fetch: Effect }` shape. Outside Alchemy, `HttpRouter.toWebHandler(routes)` returns **`{ handler, dispose }`**, not a function alone. Its handler accepts a per-request Context. `HttpApiBuilder.layer(api)` needs its group Layers and platform services. `HttpServer.layerServices` supplies a no-op filesystem for APIs that do not serve files. [Exports][E1], [router][E3], [HttpApiBuilder][E4], [HTTP services][E5].

```ts
// Bare Worker illustration. A bindings service belongs in request Context.
class Bindings extends Context.Service<Bindings, Env>()("Payments.Bindings") {}
class Invocation extends Context.Service<Invocation, ExecutionContext>()(
  "Payments.Invocation",
) {}

const routes = HttpRouter.add("GET", "/health", Effect.gen(function* () {
  const env = yield* Bindings;
  const ctx = yield* Invocation;
  ctx.waitUntil(Effect.runPromise(Effect.logDebug("Health request")));
  return HttpServerResponse.text(
    env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET ? "ok" : "unconfigured",
  );
}));
const { handler, dispose } = HttpRouter.toWebHandler(routes);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const context = Context.make(Bindings, env).pipe(Context.add(Invocation, ctx));
    return handler(request, context);
  },
};

// For Layers that read string configuration:
const configuration = (env: Env) => ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  }),
);
```

Here `Env` names the Worker bindings type. Worker secrets are available through `env`. Provide Queue and Hyperdrive objects through services, not Config strings. Supply `configuration(env)` to the Layer graph **before** it builds. In native Alchemy, its Worker ConfigProvider already performs this job. Resolve required Config during construction so deployment discovers the bindings. [Worker secrets][C15], [ConfigProvider][E6], [Alchemy provider][A19], [secret discovery][A9].

For a bare Worker, cache a ManagedRuntime per isolate only for services that hold no event-bound I/O. A runtime that includes `PgClient.make` must live per event and call `dispose()` in `finally`. Fetch, scheduled, and queue adapters can all call `runtime.runPromise(Effect.scoped(program))`. Never cache the current `ctx` in a singleton. [ManagedRuntime][E7], [Hyperdrive lifetime][C3].

In Alchemy, `yield* Cloudflare.WorkerExecutionContext` gives `waitUntil(effect)` and `raw`. Use `waitUntil` for bounded telemetry or audit work. HTTP background work has a 30-second post-response limit. Await the Queue write before acknowledgement. [Execution context source][A20], [Cloudflare context][C4].

Durable Objects can build instance Layers around their state service. Workflows need durable tasks and sleeps. An Effect fiber, `Effect.sleep`, or `Effect.retry` alone does not persist across eviction. Wrap business Effects in `Cloudflare.Workflows.task`. Close database resources before durable sleeps. [DO example][A6], [Workflow implementation][A13], [Workflow sleeps][C5].

## 3. Stripe verification, idempotency, and durable processing

**Recommendation:** Keep the official `stripe@23.0.0` gateway. It already selects fetch and disables SDK retries. Explicitly supply SubtleCrypto for webhook verification. The fifth argument to `constructEventAsync` is the crypto provider. This removes dependence on which Stripe platform entry the bundler selects. [Gateway](../../packages/invoices/src/stripe/gateway.ts), [Stripe webhook source][S2], [web platform source][S3].

```ts
import Stripe from "stripe";
import { Effect, Redacted } from "effect";
import { apiVersion } from "@portfolio/invoices/stripe/gateway";

const stripe = new Stripe(Redacted.value(secretKey), {
  apiVersion,
  httpClient: Stripe.createFetchHttpClient(),
  maxNetworkRetries: 0,
  timeout: 20_000,
});
const cryptoProvider = Stripe.createSubtleCryptoProvider(crypto.subtle);

const verify = (payload: string, signature: string) => Effect.tryPromise({
  try: () => stripe.webhooks.constructEventAsync(
    payload, signature, Redacted.value(webhookSecret), undefined, cryptoProvider,
  ),
  catch: classify("event"), // Reuse the gateway's StripeFailure classification.
});
```

The sketch uses the existing gateway's private `classify` helper inside that module. Read `request.text()` exactly once. Do not parse and reserialize before verification. Return `400` for missing or invalid signatures. Return `503` for a failed Queue write. Return `200` only after a durable write, or for a verified event the app deliberately ignores. Stripe requests quick acknowledgement and retries live deliveries for up to three days. [Signature guide][S4], [webhooks][S1], [Queue send contract][C6].

Split `Collection.receive` into verification and **verified-event processing**. Today it verifies and calls settlement inline. Queue the reduced `StripeEvent`, not the payload plus signature. Delayed signature verification can fail the timestamp tolerance. The consumer resolves `invoiceOfEvent` or `intentOfEvent`, then calls `Collection.settle`. The latter reads current Stripe state instead of trusting the snapshot. [Collection](../../packages/invoices/src/collection.ts), [event schema](../../packages/invoices/src/stripe/schema.ts), [signature tolerance][S2].

```ts
// Proposed handler Effects. Each helper returns a typed Effect.
const accept = Effect.fn("Webhook.accept")(function* (raw: string, signature: string) {
  const event = yield* StripeGateway.use((gateway) => gateway.event(raw, signature));
  if (!supportedEvent(event.type)) return;
  yield* jobs.send({ _tag: "StripeEvent", version: 1, event });
});

const consume = Effect.fn("Payments.consume")(function* (body: unknown) {
  const job = yield* Schema.decodeUnknownEffect(PaymentJob)(body);
  yield* payments.process(job); // Persist completion before Queue acknowledgement.
});
```

Queues provide at-least-once delivery without ordering guarantees. Use a unique inbox key such as `(Stripe account, event.id)`, durable completion state, and a recoverable lease. A duplicate insert alone must not skip unfinished work. Serialize settlement per invoice with database coordination. Keep the existing deterministic payment IDs and revision checks. They help with replay but do not prove concurrent refund settlement safe. Use a dead-letter queue, alerts, and a replay command. [Delivery guarantees][C1], [dead-letter queues][C7], [settlement](../../packages/invoices/src/collection.ts).

Keep the repo's stable keys: `invoice/<id>/<projectionVersion>/<step>` and `invoice/<id>/attempt/<attempt>/<step>`. Stripe retains keys for at least 24 hours and rejects changed parameters under the same key. Save Stripe IDs and operation completion in PostgreSQL. Do not assume a key prevents another mutation forever. Keep one short retry loop in the gateway and use Queue retries for longer failures. [Idempotency][S5], [gateway](../../packages/invoices/src/stripe/gateway.ts), [collection](../../packages/invoices/src/collection.ts).

Continue with snapshot events on API version `2026-09-30.endive`. The current schema requires `data.object`. Thin events need an event-notification parser and related-object retrieval. Event destinations support both formats, but this is a separate contract change. Verify availability for the six invoicing event types before any switch. [Event destinations][S6], [event schema](../../packages/invoices/src/stripe/schema.ts), [configured events](../plans/invoicing.md#online-payment-through-stripe).

Use Queues for these short independent jobs. Use Workflows for a multi-step operation that needs durable intermediate results. Inline settlement plus Cron cannot preserve every accepted event after a crash unless the endpoint first writes a durable inbox. `waitUntil` supplies no durable retry store. [Queue contract][C6], [Workflow tasks][C5], [context limits][C4].

## 4. Instalment dates and reconciliation

**Recommendation:** Use one Cron Trigger every five minutes. Scan indexed database work records, then enqueue bounded jobs. A reminder due on a calendar date does not need an isolate asleep for weeks. Recompute the plan and payment state before delivery because the owner can edit an issued invoice's plan. [Plan implementation](../../packages/invoices/src/plan.ts), [plan requirements](../plans/invoicing.md#payment-plans), [Cron][C8].

| Mechanism | Fit for this app |
| --- | --- |
| Cron + database + Queue | Best initial choice. Cron uses UTC and minute granularity. Store due dates and completion in PostgreSQL. A later scan can recover overdue work. [C8] |
| Durable Object alarms | Use for precise, mutable per-invoice timers or serialized coordination. Each object has one alarm. Delivery is at least once, with up to six automatic retries. The object must schedule the next due item. [C9] |
| Workflow `step.sleepUntil` | Use for a durable sequence of dated steps. Steps have retry configuration and persisted results. Plan changes still need cancellation, replacement, or a fresh-state decision after wake. [C5] |

```ts
import { Effect } from "effect";
import { calculate } from "@portfolio/invoices/calculate";
import { schedule, termsOf } from "@portfolio/invoices/plan";

const scan = Effect.fn("Payments.scan")(function* (now: number) {
  const today = calendarDate(now, "Atlantic/Canary");
  for (const invoice of yield* workStore.candidates(today, 100)) {
    const plan = yield* invoiceStore.plan(invoice.id);
    const paid = yield* workStore.paidAmount(invoice.id);
    const { total } = calculate(invoice.data);
    const current = schedule(plan, termsOf(invoice, total), paid, today);
    yield* workStore.ensureReminders(invoice.id, current);
  }
  yield* workStore.publishPending(jobs);
});

// Later, inside an Alchemy Workflow body:
yield* Cloudflare.Workflows.sleepUntil("due", new Date(dueAt));
yield* Cloudflare.Workflows.task("remind", reminders.sendIfStillDue(invoiceId));
```

The work-store methods and `calendarDate` are proposed application code. `termsOf` and `schedule` already exist. Define the business timezone explicitly. The current schedule uses date strings and accepts `today`. A UTC Cron must not silently change those calendar rules. [Plan source](../../packages/invoices/src/plan.ts), [Cron timezone][C8].

Use unique reminder keys that include invoice ID, plan revision, instalment ID, and reminder kind. Write work records transactionally. Publish with an outbox so a crash between database commit and Queue send remains recoverable. Re-read payment state at consumption and suppress stale jobs. An email provider needs idempotency support to prevent duplicates after a send succeeds but completion storage fails. These are design requirements derived from mutable plans and at-least-once delivery. [Plan requirements](../plans/invoicing.md#payment-plans), [Queue guarantees][C1].

Reconcile open, preparing, review, and recently paid collections in bounded pages. Recent paid collections remain candidates because refunds can change their ledger state. Queue `settle` jobs from stored Stripe invoice IDs. Advance the scan cursor only after durable publication. [Settlement and collection states](../../packages/invoices/src/collection.ts).

## 5. PostgreSQL and Hyperdrive

**Recommendation:** Keep the Drizzle Effect driver and add a Worker database adapter. Alchemy's `alchemy/Drizzle/Postgres` already uses `drizzle-orm/effect-postgres` and `@effect/sql-pg`. Its proxy opens the pool lazily and memoizes it per execution Scope. Upstream has deployed Hyperdrive/Neon CRUD and sequential-request test definitions. This is strong integration evidence, but I did not run those tests. [Adapter source][A21], [integration tests][A7].

Cloudflare officially recommends `pg` and also supports Postgres.js. `pg` requires at least 8.16.3. Postgres.js requires at least 3.4.5. Both use Worker-compatible sockets with Node compatibility. These statements do not establish support for Effect's independent protocol implementation. That client imports `node:net`, `node:tls`, `node:crypto`, and streams. Modern Workers implement outgoing Node TCP sockets. [pg guide][C10], [Postgres.js guide][C11], [Effect connection source][E8], [Worker net][C12].

If Postgres.js is selected, keep prepared statements enabled. Cloudflare's October guide warns that `prepare: false` can hang or fail under Hyperdrive transaction pooling. [Postgres.js guide][C11].

```ts
// Inside the Worker construction Effect:
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import { Layer } from "effect";
import { InvoiceDatabase } from "@portfolio/invoices/database";
import { relations } from "@portfolio/invoices/relations";

const connection = yield* Cloudflare.Hyperdrive.Connect(DatabaseConnection);
const db = yield* Drizzle.Postgres(connection.connectionString, { relations });
const InvoiceDatabaseLive = Layer.succeed(InvoiceDatabase, db);
// Provide ConnectBinding to construction. Provide InvoiceDatabaseLive to
// storeLayer and collectionLayer. Queries open the event's pool lazily.
```

`DatabaseConnection` denotes the Hyperdrive resource. Target the database's direct origin in production. Hyperdrive already pools connections. Disable Hyperdrive query caching for payment state. Use a separate reachable development database. Never reuse a Hyperdrive connection or resolved credentials across Worker events. [Hyperdrive guide][A10], [connection lifecycle][C3].

The repo's `Postgres.hosted` opens both an Effect client and a promise `pg.Pool`. That lifetime suits the Node app. The Worker only needs the invoice Effect database. Split the service/type contract from Node and PGlite adapters. Avoid importing the monolithic implementation into the Worker. Keep the Node promise adapter for better-auth. [Postgres service](../../packages/database/src/postgres.ts).

Also split `InvoiceDatabase` and `databaseLayer` from its Vite-only `import.meta.glob` migration export. Alchemy bundles Worker code with Rolldown. The inspected bundler contract does not establish support for that glob transform. Run hosted migrations as a deployment step, before the Worker deployment. Do not migrate during webhook processing. [Invoice database](../../packages/invoices/src/database.ts), [hosted migration policy](../../packages/database/src/postgres.ts), [Worker build contract][A22].

Before release, verify TLS/authentication, transactions, rollback, dates/numerics, cancellation, concurrent refunds, and repeated fetch/queue/Cron events in deployed workerd. Do not replace the Effect driver with promise queries solely because Cloudflare documents `pg`. The native Effect integration has direct upstream evidence and preserves the repo's service contracts. [Effect client][E2], [Alchemy tests][A7], [repo database](../../packages/database/src/postgres.ts).

## 6. Modules, services, and ownership

**Recommendation:** Keep domain rules in `packages/invoices`. Put Cloudflare bindings and deployment in `apps/payments`. Move Stripe commands behind the Worker if it must own all Stripe I/O. The Start app currently calls `share`, `checkout`, and `pay` locally. Keeping those calls there gives the Worker ownership of webhook/jobs only. An internal authenticated HTTP API resolves the broader ownership requirement. Preserve caller authorization in Start and verify the internal caller in the Worker. [Current server adapter](../../apps/start/src/features/invoices/collection.server.ts), [current route](../../apps/start/src/routes/invoices_.stripe.webhook.ts).

```text
apps/payments/
  alchemy.run.ts
  src/worker.ts          # Cloudflare construction and event listeners
  src/resources.ts       # Hyperdrive and Queue declarations
  src/layers.ts          # InvoiceDatabase, StripeGateway, Collection
  src/handlers.ts        # raw webhook and job adapters
  src/api.ts             # authenticated internal Stripe commands
packages/invoices/src/
  stripe/gateway.ts       # SDK, verification, typed failures, short retries
  stripe/schema.ts        # reduced verified event and Stripe types
  collection.ts           # share/checkout/pay/settle; verified-event processing
  plan.ts                 # existing schedule/options rules
  payment-jobs.ts         # versioned Schema union
  payment-work.ts         # inbox, outbox, leases, reconciliation cursor
  reminders.ts            # fresh-state checks and delivery contract
packages/database/src/
  postgres.ts             # service/type contract after adapter split
  postgres-node.ts        # hosted Node pools
  postgres-local.ts       # PGlite and local migrations
```

Use `StripeGateway`, `Collection`, `InvoiceDatabase`, `PaymentWork`, `Reconciliation`, and `Reminders` as service names. `PaymentsLive` composes them. A `ReminderDelivery` service supplies the actual sender. The current `Mailer` belongs to the web app, so do not import the auth runtime into payments. This is a proposed layout grounded in the current separation of domain and server adapters. [Collection](../../packages/invoices/src/collection.ts), [Start runtime](../../apps/start/src/features/invoices/runtime.server.ts), [mail](../plans/invoicing.md#mail).

The opencode `v2` branch uses `Context.Service`, `Layer.effect`, named `Effect.fn`, and `Schema.TaggedError`. Its workerd entry replaces Node-only services and holds the application inside a Durable Object scope. Its fetch entry eagerly builds Layers to avoid an interrupted first-request bootstrap. Copy these boundaries and naming practices. Its inspected HTTP imports still use beta paths, so do not copy those imports into Effect 4.0.0 final. [Project service][O1], [workerd profile][O2], [fetch entry][O3], [Effect final exports][E1].

```ts
import { Context, Effect, Layer, Schema } from "effect";

class ReminderFailure extends Schema.TaggedError<ReminderFailure>()(
  "ReminderFailure", { message: Schema.String },
) {}
class ReminderDelivery extends Context.Service<ReminderDelivery, {
  send: (key: string) => Effect.Effect<void, ReminderFailure>;
}>()("Payments.ReminderDelivery") {}
class Reminders extends Context.Service<Reminders, {
  send: (key: string) => Effect.Effect<void, ReminderFailure>;
}>()("Payments.Reminders") {}

const RemindersLive = Layer.effect(Reminders, Effect.gen(function* () {
  const delivery = yield* ReminderDelivery;
  return Reminders.of({
    send: Effect.fn("Reminders.send")((key: string) => delivery.send(key)),
  });
}));
```

This fragment shows service composition only. `sendIfStillDue` must add the work-store and plan checks described in section 4. Keep Config recipes at the deployment boundary and typed failures at external I/O boundaries. These practices match the repo's gateway and opencode's service construction. [Gateway](../../packages/invoices/src/stripe/gateway.ts), [Project service][O1].

## 7. Pins, risks, and unverified work

**Recommendation:** Preserve the current Effect, Stripe, and Drizzle pins for the first proof. Add Alchemy with an exact version. Inspect the resulting lockfile before accepting optional peer resolution. [Current lockfile](../../bun.lock), [Alchemy metadata][A1].

```json
{
  "dependencies": {
    "effect": "4.0.0",
    "@effect/sql-pg": "4.0.0",
    "stripe": "23.0.0",
    "drizzle-orm": "1.0.0-rc.5-5935859"
  },
  "devDependencies": {
    "alchemy": "2.0.0-beta.80",
    "@effect/platform-node": "4.0.0"
  }
}
```

`@effect/platform-node` is for the Node infrastructure CLI, not the Worker bundle. There is no dedicated Cloudflare platform package required by these HTTP adapters. `effect/workers` concerns worker-thread abstractions and is not the Cloudflare event runtime. [Alchemy launcher][A16], [Effect package exports][E1], [Effect worker module][E9].

- **Peer mismatch:** Alchemy declares optional Drizzle peers `1.0.0-rc.5-ab785fc`, while this repo locks `1.0.0-rc.5-5935859`. Its optional `pg` peer is `^8.22.0`, while the repo has `8.16.3`. Verify types and one dependency graph. Do not silently change the app's pins. [A1], [lockfile](../../bun.lock).
- **Patch releases:** The registry already lists Effect and sql-pg `4.0.1` on October 5. This note verifies **4.0.0**, as requested. Review later patch adoption separately. Alchemy's ranges can resolve newer SQL packages unless the lockfile fixes them. [Effect registry][E10], [SQL registry][E11], [A1].
- **Runtime date:** Alchemy beta.80's local runtime pins workerd `1.20260918.1`. Verify that it accepts the chosen October compatibility date. A local simulator result does not prove production Hyperdrive behavior. [Runtime metadata][A23], [C3].
- **Bootstrap and scopes:** Alchemy runs construction during planning and at runtime. Do not make Stripe requests or open PostgreSQL connections during construction. Use its deferred adapters. Never hold a client across events. [A2], [A18], [A21], [C3].
- **Durability limits:** Queue messages have a 128 KB limit. Delays reach 24 hours. Keep reduced event jobs small and keep long due dates in PostgreSQL. Alert on dead-letter and backlog growth. [Queue limits][C13], [send API][C6], [C7].
- **Settlement concurrency:** Database completion must follow settlement. Verify duplicate events, concurrent invoices, concurrent refunds, plan edits, and interrupted leases. Deterministic ledger IDs alone do not prove every concurrent path. [collection](../../packages/invoices/src/collection.ts), [C1].
- **Not exercised:** No packages were installed. No code was changed. No sketches were compiled. No Worker, Stripe sandbox, database connection, or reminder sender ran. The repo's plan also records a pending real Stripe sandbox payment check. [Invoicing plan](../plans/invoicing.md#online-payment-through-stripe).

The release gate is a deployed sandbox proof: verify signature, durable enqueue, duplicate delivery, forced retry, settlement, refund, and reminder suppression. Run the exact locked database driver in that proof. Verify that the app keeps no Stripe command path if full Worker ownership is selected. This gate follows the unverified integration boundaries identified in the cited sources. [A7], [S1], [C1], [current command adapter](../../apps/start/src/features/invoices/collection.server.ts).

## Sources

All external sources are first-party docs, publisher metadata, or source code. Alchemy source links use `v2.0.0-beta.80`. Effect source links use the 4.0.0 release commit. Opencode links use the inspected `v2` commit. Local links identify the repo context used for each recommendation.

- Alchemy releases: [current package][A1], [old package][A3], [repository redirect][A4], [scoped lookup][A5], [local runtime pin][A23].
- Alchemy Workers: [bridge][A2], [Effect example][A6], [stack example][A8], [ConfigProvider][A19], [execution context][A20], [Worker contract][A22].
- Alchemy infrastructure: [secrets][A9], [Hyperdrive][A10], [Queues][A11], [Cron][A12], [Workflows][A13], [state][A17].
- Alchemy tools and SQL: [local development][A14], [local database example][A15], [CLI][A16], [execution scopes][A18], [Drizzle adapter][A21], [integration tests][A7].
- Effect HTTP: [exports][E1], [router][E3], [HttpApiBuilder][E4], [HTTP services][E5].
- Effect runtime and SQL: [ConfigProvider][E6], [ManagedRuntime][E7], [PgClient][E2], [transport][E8], [workers][E9], [Effect releases][E10], [SQL releases][E11].
- Cloudflare messaging: [delivery guarantees][C1], [retries][C2], [JavaScript API][C6], [dead-letter queues][C7], [limits][C13].
- Cloudflare scheduling: [Cron][C8], [alarms][C9], [Workflow sleeps and retries][C5], [execution context][C4].
- Cloudflare PostgreSQL: [connection lifetime][C3], [pg][C10], [Postgres.js][C11], [Node TCP][C12], [Node compatibility][C14], [secrets][C15].
- Stripe: [webhooks][S1], [SDK verification][S2], [SDK web platform][S3], [signature guide][S4], [idempotency][S5], [event destinations][S6].
- Opencode v2: [service conventions][O1], [workerd profile][O2], [fetch entry][O3].

[A1]: https://registry.npmjs.org/alchemy/2.0.0-beta.80 "Alchemy published release metadata"
[A2]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workers/WorkerBridge.ts "Alchemy Worker bridge"
[A3]: https://registry.npmjs.org/alchemy-effect "Legacy alchemy-effect package metadata"
[A4]: https://api.github.com/repos/alchemy-run/alchemy-effect "Alchemy repository redirect"
[A5]: https://registry.npmjs.org/@alchemy.run%2feffect "Scoped Effect package lookup: 404 on research date"
[A6]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/examples/cloudflare-dev/src/EffectWorker.ts "Effect Worker and Durable Object example"
[A7]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/examples/cloudflare-neon-drizzle/test/integ.test.ts "Hyperdrive and Drizzle integration tests"
[A8]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/examples/cloudflare-dev/alchemy.run.ts "Cloudflare stack and async bindings example"
[A9]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/website/src/content/docs/cloudflare/security/secrets-env.mdx "Config and secret discovery"
[A10]: https://alchemy.run/cloudflare/data/hyperdrive/ "Hyperdrive configuration and connection guide"
[A11]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Queues/EventSource.ts "Queue consumer registration and acknowledgement"
[A12]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workers/CronEventSource.ts "Cron registration and failure behavior"
[A13]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workflows/Workflow.ts "Workflow declarations, tasks, and sleeps"
[A14]: https://alchemy.run/cloudflare/local-development/ "Local workerd runtime"
[A15]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/examples/cloudflare-dev/src/HyperdriveWorker.ts "Local Hyperdrive origin requirement"
[A16]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/bin/cli.js "CLI runtime selection and Node minimum"
[A17]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/website/src/content/docs/state-store/index.mdx "Local and remote state stores"
[A18]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Runtime/ExecutionMemo.ts "Event-scoped resource memoization"
[A19]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workers/ConfigProvider.ts "Worker ConfigProvider"
[A20]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workers/WorkerRuntime.ts "Effect execution context"
[A21]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Drizzle/Postgres.ts "Drizzle Effect PostgreSQL adapter"
[A22]: https://github.com/alchemy-run/alchemy/blob/v2.0.0-beta.80/packages/alchemy/src/Cloudflare/Workers/Worker.ts "Worker props and bundling contract"
[A23]: https://registry.npmjs.org/@alchemy.run%2fcloudflare-runtime/2.0.0-beta.80 "Alchemy runtime workerd pin"
[E1]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/package.json "Effect 4.0.0 exports"
[E2]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/sql/pg/src/PgClient.ts "Effect PostgreSQL client"
[E3]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/http/HttpRouter.ts "HttpRouter conversion APIs"
[E4]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/http-api/HttpApiBuilder.ts "HttpApi group and layer requirements"
[E5]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/http/HttpServer.ts "HTTP platform services"
[E6]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/ConfigProvider.ts "ConfigProvider.fromUnknown and layer"
[E7]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/ManagedRuntime.ts "ManagedRuntime lifecycle"
[E8]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/sql/pg/src/PgConnection.ts "Native PostgreSQL transport"
[E9]: https://github.com/Effect-TS/effect/blob/67ba4e46a11ccda0b6761578bfd22c04ae00167d/packages/effect/src/workers/Worker.ts "Effect worker abstractions"
[E10]: https://registry.npmjs.org/effect "Effect release tags and dates"
[E11]: https://registry.npmjs.org/@effect%2fsql-pg "Effect sql-pg release tags and dates"
[C1]: https://developers.cloudflare.com/queues/reference/delivery-guarantees/ "Queue delivery guarantees"
[C2]: https://developers.cloudflare.com/queues/configuration/batching-retries/ "Acknowledgement and retry rules"
[C3]: https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/ "Hyperdrive client lifetime"
[C4]: https://developers.cloudflare.com/workers/runtime-apis/context/ "ExecutionContext and waitUntil limits"
[C5]: https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/ "Durable sleeps and step retries"
[C6]: https://developers.cloudflare.com/queues/configuration/javascript-apis/ "Queue send and consumer APIs"
[C7]: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/ "Dead-letter queues"
[C8]: https://developers.cloudflare.com/workers/configuration/cron-triggers/ "Cron timezone and granularity"
[C9]: https://developers.cloudflare.com/durable-objects/api/alarms/ "Alarm scheduling and retries"
[C10]: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ "pg support"
[C11]: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/postgres-js/ "Postgres.js support"
[C12]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/net/ "Outgoing Node TCP sockets"
[C13]: https://developers.cloudflare.com/queues/platform/limits/ "Queue limits"
[C14]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/ "Node compatibility dates and defaults"
[C15]: https://developers.cloudflare.com/workers/configuration/secrets/ "Worker secret bindings"
[S1]: https://docs.stripe.com/webhooks "Webhook acknowledgement, retries, and local forwarding"
[S2]: https://github.com/stripe/stripe-node/blob/v23.0.0/src/Webhooks.ts "constructEventAsync and timestamp tolerance"
[S3]: https://github.com/stripe/stripe-node/blob/v23.0.0/src/platform/WebPlatformFunctions.ts "Fetch and SubtleCrypto platform"
[S4]: https://docs.stripe.com/webhooks/signature "Raw webhook body"
[S5]: https://docs.stripe.com/api/idempotent_requests "Idempotency key retention"
[S6]: https://docs.stripe.com/event-destinations "Snapshot and thin event contracts"
[O1]: https://github.com/sst/opencode/blob/e1b94a138e054f219010ffaacdbe5e303fbc926a/packages/core/src/project.ts "opencode service and error conventions"
[O2]: https://github.com/sst/opencode/blob/e1b94a138e054f219010ffaacdbe5e303fbc926a/packages/server/src/workerd.ts "opencode workerd replacement profile"
[O3]: https://github.com/sst/opencode/blob/e1b94a138e054f219010ffaacdbe5e303fbc926a/packages/server/src/fetch.ts "opencode eager fetch application build"

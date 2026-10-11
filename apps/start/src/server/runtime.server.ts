import { NodeServices } from '@effect/platform-node';
import { PostgresHosted } from '@portfolio/database/hosted';
import { PostgresLocal } from '@portfolio/database/local';
import { customerAccessLayer } from '@portfolio/invoices/customer-access';
import { databaseLayer } from '@portfolio/invoices/database';
import { documentsLayer } from '@portfolio/invoices/documents';
import { migrations as invoiceMigrations } from '@portfolio/invoices/migrations';
import { storeLayer } from '@portfolio/invoices/store';
import { getRequest } from '@tanstack/react-start/server';
import {
  Cause,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  Path,
} from 'effect';
import { FetchHttpClient } from 'effect/http';
import { migrations as authMigrations } from '../features/auth/migrations';
import { authLayer } from './auth.server';
import { AppConfig, appConfigLayer } from './config.server';
import { geocoderLayer } from './geocoder.server';
import { mailerLayer } from './mail.server';
import { paymentsLayer } from './payments.server';
import { CurrentRequest, Refused } from './request.server';
import { appSecretLayer } from './secret.server';

// The invoice server as one layer graph, built once per process, and the
// edge where its effects meet TanStack Start. Server functions and routes
// call `serve`; nothing else runs an effect or throws a Response.

/**
 * Where the database lives: hosted when DATABASE_URL is set, otherwise an
 * embedded PGlite in the data directory that brings itself up to date.
 */
const postgresLayer = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    if (settings.databaseUrl)
      return PostgresHosted.layer({ url: settings.databaseUrl });
    const path = yield* Path.Path;
    return PostgresLocal.layer({
      directory: path.resolve(settings.dataDirectory, 'pglite'),
      migrations: [invoiceMigrations, authMigrations],
    });
  }),
);

const invoicesLayer = documentsLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(storeLayer, customerAccessLayer)),
  Layer.provideMerge(databaseLayer),
);

/** Every service a request may use, over one database connection. */
export const appLayer = Layer.mergeAll(
  authLayer,
  paymentsLayer,
  geocoderLayer,
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(invoicesLayer, mailerLayer, appSecretLayer),
  ),
  Layer.provideMerge(postgresLayer),
  Layer.provideMerge(appConfigLayer),
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)),
);

/** The services the app's effects run with. */
export type AppServices = Layer.Success<typeof appLayer>;

declare global {
  var invoiceRuntime:
    | ManagedRuntime.ManagedRuntime<AppServices, Layer.Error<typeof appLayer>>
    | undefined;
}

/** The runtime, kept across development reloads so the local database opens once. */
const runtime = () => {
  globalThis.invoiceRuntime ??= ManagedRuntime.make(appLayer);
  return globalThis.invoiceRuntime;
};

/**
 * Runs one request's effect and answers with its result. A Refused becomes
 * the response it describes, thrown so TanStack Start sends it as is; any
 * other failure is a defect and propagates as a server error.
 */
export async function serve<A>(
  effect: Effect.Effect<A, Refused, AppServices | CurrentRequest>,
  request: Request = getRequest(),
): Promise<A> {
  const exit = await runtime().runPromiseExit(
    effect.pipe(Effect.provideService(CurrentRequest, request)),
  );
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.findErrorOption(exit.cause);
  if (Option.isSome(failure) && failure.value instanceof Refused)
    throw new Response(failure.value.message, {
      status: failure.value.status,
    });
  throw Cause.squash(exit.cause);
}

import { Postgres } from '@portfolio/database';
import { Context, Effect, Layer } from 'effect';
import { relations } from './relations';

/** The invoice tables as a Drizzle database whose queries are Effects. */
export class InvoiceDatabase extends Context.Service<
  InvoiceDatabase,
  Postgres.Database<typeof relations>
>()('InvoiceDatabase') {}

/** Builds the invoice database over whatever connection the app provides. */
export const databaseLayer = Layer.effect(
  InvoiceDatabase,
  Effect.gen(function* () {
    const postgres = yield* Postgres.Postgres;
    return yield* postgres.drizzle(relations);
  }),
);

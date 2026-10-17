import { PostgresLocal } from '@portfolio/database/local';
import { customerAccessLayer } from '@portfolio/invoices/customer-access';
import { databaseLayer } from '@portfolio/invoices/database';
import { documentsLayer } from '@portfolio/invoices/documents';
import { migrations } from '@portfolio/invoices/migrations';
import { outboxLayer } from '@portfolio/invoices/outbox';
import { quotesLayer } from '@portfolio/invoices/quotes';
import { storeLayer } from '@portfolio/invoices/store';
import { Layer, ManagedRuntime } from 'effect';

/**
 * The invoice services over a fresh in-memory database with every invoice
 * migration applied: the same schema production runs, at test speed.
 */
export const testLayer = quotesLayer.pipe(
  Layer.provideMerge(documentsLayer),
  Layer.provideMerge(Layer.mergeAll(storeLayer, customerAccessLayer)),
  Layer.provideMerge(outboxLayer.pipe(Layer.provideMerge(databaseLayer))),
  Layer.provideMerge(PostgresLocal.layer({ migrations: [migrations] })),
);

/** A runtime over `testLayer`; dispose it after the suite. */
export const testRuntime = () => ManagedRuntime.make(testLayer);

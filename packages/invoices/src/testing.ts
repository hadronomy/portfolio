import { PostgresLocal } from '@portfolio/database/local';
import { Layer, ManagedRuntime } from 'effect';
import { customerAccessLayer } from './customer-access';
import { databaseLayer } from './database';
import { documentsLayer } from './documents';
import { migrations } from './migrations';
import { outboxLayer } from './outbox';
import { quotesLayer } from './quotes';
import { storeLayer } from './store';

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

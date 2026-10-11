import { defineRelations } from 'drizzle-orm';
import * as tables from './tables';

/** How the invoice tables join, for Drizzle's relational queries (`db.query.*`). */
export const relations = defineRelations(tables, (r) => ({
  invoices: {
    artifacts: r.many.artifacts(),
    collection: r.one.collections({
      from: r.invoices.id,
      to: r.collections.invoiceId,
    }),
    links: r.many.links(),
    offer: r.one.offers({ from: r.invoices.id, to: r.offers.invoiceId }),
  },
  artifacts: {
    invoice: r.one.invoices({
      from: r.artifacts.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
  },
  collections: {
    invoice: r.one.invoices({
      from: r.collections.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
  },
  offers: {
    invoice: r.one.invoices({
      from: r.offers.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
  },
  links: {
    invoice: r.one.invoices({
      from: r.links.invoiceId,
      to: r.invoices.id,
      optional: false,
    }),
  },
}));

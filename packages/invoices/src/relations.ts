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
    response: r.one.responses({
      from: r.invoices.id,
      to: r.responses.quoteId,
    }),
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
  billed: {
    quote: r.one.invoices({
      from: r.billed.quoteId,
      to: r.invoices.id,
      optional: false,
    }),
  },
  responses: {
    quote: r.one.invoices({
      from: r.responses.quoteId,
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

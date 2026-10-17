import type { InvoiceId } from '@portfolio/invoices/model';
import { queryOptions } from '@tanstack/react-query';
import {
  findAddresses,
  findLocality,
  getAgents,
  getCollection,
  getQuoteDeliveries,
  getQuoteDetails,
  getQuoteEmails,
  getQuoteLinks,
  getWorkspace,
  previewQuoteEmail,
} from '~/features/invoices/api';

// Every query the invoices app makes, keyed in one place. A screen reads
// with `useQuery(invoiceQueries.x(...))`, a loader prefetches the same
// entry, and a change invalidates it by the same key, so the three cannot
// drift. Keys nest under the document they describe: invalidating
// `invoiceQueries.document(id)` refreshes everything about that document.

const root = ['invoices'] as const;

/** The key every query about one document starts with. */
const document = (id: InvoiceId) => [...root, 'document', id] as const;

export const invoiceQueries = {
  document,

  /** Every document, customer and item, with the owner's preferences. */
  workspace: () =>
    queryOptions({
      queryKey: [...root, 'workspace'] as const,
      queryFn: () => getWorkspace(),
    }),

  /** An invoice's payment link and what Stripe last said about it. */
  collection: (id: InvoiceId) =>
    queryOptions({
      queryKey: [...document(id), 'collection'] as const,
      queryFn: () => getCollection({ data: { id } }),
    }),

  quoteLinks: (id: InvoiceId) =>
    queryOptions({
      queryKey: [...document(id), 'quote-links'] as const,
      queryFn: () => getQuoteLinks({ data: { id } }),
    }),

  quoteEmails: (id: InvoiceId) =>
    queryOptions({
      queryKey: [...document(id), 'quote-emails'] as const,
      queryFn: () => getQuoteEmails({ data: { id } }),
    }),

  quoteDeliveries: (id: InvoiceId) =>
    queryOptions({
      queryKey: [...document(id), 'quote-deliveries'] as const,
      queryFn: () => getQuoteDeliveries({ data: { id } }),
    }),

  /** The customer's details on a quote: waiting, confirmed, or changed. */
  quoteDetails: (id: InvoiceId) =>
    queryOptions({
      queryKey: [...document(id), 'quote-details'] as const,
      queryFn: () => getQuoteDetails({ data: { id } }),
    }),

  quoteEmailPreview: (id: InvoiceId, note: string) =>
    queryOptions({
      queryKey: [...document(id), 'quote-email-preview', note] as const,
      queryFn: () => previewQuoteEmail({ data: { id, note } }),
    }),

  agents: () =>
    queryOptions({
      queryKey: [...root, 'agents'] as const,
      queryFn: () => getAgents(),
    }),

  // Streets and localities change rarely, and a lookup costs a request to
  // the address service: answers are kept for minutes, not seconds.
  addresses: (country: string, query: string) =>
    queryOptions({
      queryKey: [
        ...root,
        'addresses',
        country,
        query.trim().toLowerCase(),
      ] as const,
      queryFn: ({ signal }) =>
        findAddresses({ data: { query, country }, signal }),
      staleTime: 5 * 60_000,
    }),

  locality: (country: string, postalCode: string) =>
    queryOptions({
      queryKey: [...root, 'locality', country, postalCode.trim()] as const,
      queryFn: ({ signal }) =>
        findLocality({ data: { postalCode, country }, signal }),
      staleTime: 60 * 60_000,
    }),
};

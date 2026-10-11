import { balance, calculate } from '@portfolio/invoices/calculate';
import type { Invoice, Payment } from '@portfolio/invoices/model';
import {
  type QuoteResponse,
  quoteState,
} from '@portfolio/invoices/quote-model';

/**
 * What the owner needs to know about a document: a draft; an invoice by
 * whether it is paid; a quote by where its customer's answer stands.
 */
export type DocumentStatus =
  | 'draft'
  | 'unpaid'
  | 'overdue'
  | 'paid'
  | 'open'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'invoiced';

/** Today as an ISO date, the form due dates are stored in. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derives the status from payments, answers and dates. Nothing stores it:
 * recording a payment or an answer changes it on the next render.
 */
export function documentStatus(
  invoice: Invoice,
  payments: readonly Payment[],
  responses: Readonly<Record<string, QuoteResponse>>,
  on = today(),
) {
  const total = calculate(invoice.data).total;
  const remaining = balance(
    total,
    payments.filter((payment) => payment.invoiceId === invoice.id),
  );
  const status: DocumentStatus =
    invoice.status === 'draft'
      ? 'draft'
      : invoice.data.kind === 'quote'
        ? quoteState(invoice, responses[invoice.id] ?? null, on)
        : Number(remaining) <= 0
          ? 'paid'
          : invoice.data.dueDate < on
            ? 'overdue'
            : 'unpaid';
  return { status, total, remaining };
}

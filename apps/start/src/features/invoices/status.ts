import { balance, calculate } from '@portfolio/invoices/calculate';
import type { Invoice, Payment } from '@portfolio/invoices/model';

/** What the owner needs to know about a document: its lifecycle and, once issued, whether it is paid. */
export type DocumentStatus =
  | 'draft'
  | 'proforma'
  | 'unpaid'
  | 'overdue'
  | 'paid';

/** Today as an ISO date, the form due dates are stored in. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derives the status from payments and the due date. Nothing stores it:
 * recording or reversing a payment changes the answer on the next render.
 */
export function documentStatus(
  invoice: Invoice,
  payments: readonly Payment[],
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
      : invoice.data.kind === 'proforma'
        ? 'proforma'
        : Number(remaining) <= 0
          ? 'paid'
          : invoice.data.dueDate < on
            ? 'overdue'
            : 'unpaid';
  return { status, total, remaining };
}

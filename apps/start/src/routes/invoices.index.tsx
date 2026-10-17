import { createFileRoute } from '@tanstack/react-router';
import { InvoiceList } from '~/features/invoices/invoice-list';
export const Route = createFileRoute('/invoices/')({ component: InvoiceList });

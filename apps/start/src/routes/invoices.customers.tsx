import { createFileRoute } from '@tanstack/react-router';
import { CustomerDirectory } from '../features/invoices/directory';
export const Route = createFileRoute('/invoices/customers')({
  component: CustomerDirectory,
});

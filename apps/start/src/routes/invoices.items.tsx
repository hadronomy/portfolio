import { createFileRoute } from '@tanstack/react-router';
import { ItemDirectory } from '~/features/invoices/directory';
export const Route = createFileRoute('/invoices/items')({
  component: ItemDirectory,
});

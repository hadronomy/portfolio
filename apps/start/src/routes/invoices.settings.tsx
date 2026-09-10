import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '../features/invoices/settings';
export const Route = createFileRoute('/invoices/settings')({
  component: Settings,
});

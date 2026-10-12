import { createFileRoute, redirect } from '@tanstack/react-router';
import { getViewer } from '../features/invoices/api';
import { InvoiceShell } from '../features/invoices/shell';
import { InvoiceError } from './-invoice-error';
import { invoiceRouteError } from './-invoice-errors';

function InvoicesPending() {
  return (
    <div className="iv-signin">
      <output className="iv-message">Loading workspace…</output>
    </div>
  );
}

export const Route = createFileRoute('/invoices')({
  loader: async () => {
    const viewer = await getViewer();
    // A customer's invoices live on their own page, not in the workspace.
    if (viewer?._tag === 'Customer')
      throw redirect({ to: '/invoices/account' });
    return viewer;
  },
  head: () => ({
    meta: [
      { title: 'Invoices · Hadronomy' },
      { name: 'robots', content: 'noindex, nofollow' },
      // Matches the workspace canvas, so browser chrome blends into it.
      { name: 'theme-color', content: '#f6f6f5' },
    ],
  }),
  pendingComponent: InvoicesPending,
  onError: invoiceRouteError,
  errorComponent: InvoiceError,
  component: () => (
    <InvoiceShell signedIn={Route.useLoaderData()?._tag === 'Owner'} />
  ),
});

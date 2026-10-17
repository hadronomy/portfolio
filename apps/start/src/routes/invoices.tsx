import { createFileRoute, redirect } from '@tanstack/react-router';
import { getViewer } from '~/features/invoices/api';
import { invoiceQueries } from '~/features/invoices/queries';
import { InvoiceShell } from '~/features/invoices/shell';
import { InvoiceError } from '~/routes/-invoice-error';
import { invoiceRouteError } from '~/routes/-invoice-errors';

function InvoicesPending() {
  return (
    <div className="iv-signin">
      <output className="iv-message">Loading workspace…</output>
    </div>
  );
}

export const Route = createFileRoute('/invoices')({
  loader: async ({ context }) => {
    const viewer = await getViewer();
    // A customer's invoices live on their own page, not in the workspace.
    if (viewer?._tag === 'Customer')
      throw redirect({ to: '/invoices/account' });
    // The workspace is in the page from its first paint, and a document
    // opened from it has its data already.
    if (viewer?._tag === 'Owner')
      await context.queryClient.ensureQueryData(invoiceQueries.workspace());
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

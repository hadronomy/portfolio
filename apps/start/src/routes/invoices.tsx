import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getViewer } from '../features/invoices/api';
import { InvoiceShell } from '../features/invoices/shell';

function InvoicesPending() {
  return (
    <div className="iv-signin">
      <output className="iv-message">Loading workspace…</output>
    </div>
  );
}

function InvoicesError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="iv-signin">
      <div className="iv-message" role="alert">
        <p>
          {error instanceof Error
            ? error.message
            : 'The workspace could not load.'}
        </p>
        <button
          type="button"
          className="iv-btn"
          data-variant="primary"
          onClick={() => reset()}
        >
          <span>Try again</span>
        </button>
      </div>
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
  errorComponent: InvoicesError,
  component: () => (
    <InvoiceShell signedIn={Route.useLoaderData()?._tag === 'Owner'} />
  ),
});

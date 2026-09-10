import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { getIdentity } from '../features/invoices/api';
import stylesheet from '../features/invoices/invoices.css?url';
import { InvoiceShell } from '../features/invoices/shell';

function InvoicesPending() {
  return (
    <div className="iv-app">
      <output className="iv-preview-message">Loading workspace…</output>
    </div>
  );
}

function InvoicesError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="iv-app">
      <div className="iv-preview-message" role="alert">
        <p>
          {error instanceof Error
            ? error.message
            : 'The workspace could not load.'}
        </p>
        <button className="iv-primary" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/invoices')({
  loader: () => getIdentity(),
  head: () => ({
    meta: [
      { title: 'Invoices · Hadronomy' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'stylesheet', href: stylesheet }],
  }),
  pendingComponent: InvoicesPending,
  errorComponent: InvoicesError,
  component: () => <InvoiceShell signedIn={!!Route.useLoaderData()} />,
});

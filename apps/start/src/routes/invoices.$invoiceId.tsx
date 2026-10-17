import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute, Link } from '@tanstack/react-router';
import { InvoiceEditor } from '~/features/invoices/editor';
import { InvoiceError } from '~/routes/-invoice-error';
import { invoiceRouteError } from '~/routes/-invoice-errors';

function EditorPending() {
  return <output className="iv-message">Loading invoice…</output>;
}

function EditorError(props: ErrorComponentProps) {
  const { reset } = props;
  if (import.meta.env.PROD) return <InvoiceError {...props} />;
  return (
    <div className="iv-message" role="alert">
      <p>The invoice could not load.</p>
      <div className="iv-inline">
        <button
          type="button"
          className="iv-btn"
          data-variant="primary"
          onClick={() => reset()}
        >
          <span>Try again</span>
        </button>
        <Link to="/invoices" className="iv-btn" data-variant="secondary">
          <span>Back to invoices</span>
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/invoices/$invoiceId')({
  component: () => <InvoiceEditor id={Route.useParams().invoiceId} />,
  pendingComponent: EditorPending,
  onError: invoiceRouteError,
  errorComponent: EditorError,
});

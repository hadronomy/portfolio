import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute, Link } from '@tanstack/react-router';
import { InvoiceEditor } from '../features/invoices/editor';

function EditorPending() {
  return <output className="iv-message">Loading invoice…</output>;
}

function EditorError({ reset }: ErrorComponentProps) {
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
  errorComponent: EditorError,
});

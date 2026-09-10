import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute, Link } from '@tanstack/react-router';
import { InvoiceEditor } from '../features/invoices/editor';

function EditorPending() {
  return <output className="iv-preview-message">Loading invoice…</output>;
}

function EditorError({ reset }: ErrorComponentProps) {
  return (
    <div className="iv-preview-message" role="alert">
      <p>The invoice could not load.</p>
      <div>
        <button onClick={() => reset()}>Try again</button>
        <Link to="/invoices">Back to invoices</Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/invoices/$invoiceId')({
  component: () => <InvoiceEditor id={Route.useParams().invoiceId} />,
  pendingComponent: EditorPending,
  errorComponent: EditorError,
});

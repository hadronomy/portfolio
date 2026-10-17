import { type Locale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import {
  type ErrorComponentProps,
  useRouterState,
} from '@tanstack/react-router';
import { coverArt } from '~/features/invoices/covers';
import { errorRequestId } from '~/routes/-invoice-errors';
import '~/features/invoices/invoices.css';

// Customer pages speak their document's language, which a failed page can
// no longer read, so they fall back to Spanish. The owner's workspace is
// English.
const customerPaths = /^\/invoices\/(?:quote|pay|account|privacy)(?:\/|$)/;
const localeOf = (pathname: string): Locale =>
  pathname.startsWith('/invoices') && !customerPaths.test(pathname)
    ? 'en'
    : 'es';

export function InvoiceError({ error, reset }: ErrorComponentProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const t = translate(localeOf(pathname));
  // Only the server's ID is shown: it is the one its log line carries.
  const reference = errorRequestId(error);
  return (
    <div className="iv-signin">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.ember.backdrop} alt="" />
      </div>
      <main className="iv-signin-card iv-error" role="alert">
        <h1>{t(m.error_title)}</h1>
        <p>
          {import.meta.env.DEV && error instanceof Error
            ? error.message
            : t(m.error_detail)}
        </p>
        {reference && (
          <p className="iv-error-reference">
            {t(m.error_reference)} <span className="iv-num">{reference}</span>
          </p>
        )}
        <button
          type="button"
          className="iv-btn"
          data-variant="primary"
          onClick={() => reset()}
        >
          <span>{t(m.error_try_again)}</span>
        </button>
      </main>
    </div>
  );
}

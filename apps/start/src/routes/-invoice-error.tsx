import { baseLocale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useState } from 'react';
import { errorRequestId } from './-invoice-errors';

export function InvoiceError({ error, reset }: ErrorComponentProps) {
  const t = translate(baseLocale);
  const [requestId] = useState(
    () =>
      errorRequestId(error) ??
      crypto.randomUUID().replaceAll('-', '').slice(0, 12),
  );
  return (
    <div className="iv-signin">
      <div className="iv-message" role="alert">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
          <p>
            {import.meta.env.DEV && error instanceof Error
              ? error.message
              : t(m.pay_unavailable_detail)}
          </p>
          {requestId && (
            <p>
              <code>{requestId}</code>
            </p>
          )}
          <button
            type="button"
            className="iv-btn"
            data-variant="primary"
            onClick={() => reset()}
          >
            <span>{t(m.pay_try_again)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

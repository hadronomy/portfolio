import { m } from '@portfolio/i18n/messages';
import { useT } from '../../lib/i18n';
import './privacy.css';

export function CollectionNotice({
  purpose,
  controller,
  digest,
}: {
  controller: string;
} & (
  | { purpose: 'signin' | 'payment'; digest?: never }
  | { purpose: 'quote'; digest: string }
)) {
  const t = useT();
  const message = {
    signin: m.privacy_signin_short,
    payment: m.privacy_payment_short,
    quote: m.quote_signature,
  }[purpose];
  return (
    <p className="iv-collection-notice" data-privacy-notice={purpose}>
      {t(message, {
        controller: controller.trim() || t(m.privacy_controller_unknown),
      })}{' '}
      {purpose === 'quote' && (
        <>
          <span className="iv-num" title={digest}>
            {t(m.quote_fingerprint)} {digest.slice(0, 12)}
          </span>{' '}
        </>
      )}
      <a href={`/invoices/privacy?lang=${t.locale}`}>{t(m.privacy_link)}</a>
    </p>
  );
}

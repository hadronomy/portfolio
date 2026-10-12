import { m } from '@portfolio/i18n/messages';
import { useT } from '../../lib/i18n';
import './privacy.css';

export function CollectionNotice({
  purpose,
  controller,
}: {
  purpose: 'signin' | 'payment' | 'quote';
  controller: string;
}) {
  const t = useT();
  const message = {
    signin: m.privacy_signin_short,
    payment: m.privacy_payment_short,
    quote: m.privacy_quote_short,
  }[purpose];
  return (
    <p className="iv-collection-notice" data-privacy-notice={purpose}>
      {t(message, {
        controller: controller.trim() || t(m.privacy_controller_unknown),
      })}{' '}
      <a href={`/invoices/privacy?lang=${t.locale}`}>{t(m.privacy_link)}</a>
    </p>
  );
}

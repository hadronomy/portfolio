import { m } from '@portfolio/i18n/messages';
import { formatAddress } from '@portfolio/invoices/address';
import type { Language } from '@portfolio/invoices/model';
import type { PrivacyController } from '@portfolio/invoices/privacy';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Speak, useT } from '../../lib/i18n';
import { coverArt } from '../invoices/covers';
import '../invoices/invoices.css';
import './privacy.css';

const sections = [
  { id: 'purposes', title: m.privacy_purposes_title },
  { id: 'data', title: m.privacy_data_title },
  { id: 'recipients', title: m.privacy_recipients_title },
  { id: 'transfers', title: m.privacy_transfers_title },
  { id: 'retention', title: m.privacy_retention_title },
  { id: 'rights', title: m.privacy_rights_title },
  { id: 'required', title: m.privacy_required_title },
  { id: 'cookies', title: m.privacy_cookies_title },
] as const;

export function PrivacyPage({
  language,
  controller,
}: {
  language: Language;
  controller: PrivacyController | null;
}) {
  return (
    <Speak locale={language}>
      <Privacy controller={controller} />
    </Speak>
  );
}

function Privacy({ controller }: { controller: PrivacyController | null }) {
  const t = useT();
  const complete =
    controller?.name.trim() &&
    controller.taxId.trim() &&
    controller.email.trim() &&
    controller.address.lines.trim();
  const purposes = [
    [m.privacy_contract_title, m.privacy_contract],
    [m.privacy_tax_title, m.privacy_tax],
    [m.privacy_access_title, m.privacy_access],
    [m.privacy_security_title, m.privacy_security],
    [m.privacy_rights_purpose_title, m.privacy_rights_purpose],
  ] as const;
  return (
    <div className="iv-pay iv-privacy" lang={t.locale}>
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.tide.backdrop} alt="" data-active="true" />
      </div>
      <div className="iv-privacy-sheet">
        <header className="iv-privacy-header">
          <a href="/invoices/account" className="iv-privacy-back">
            <ArrowLeft size={16} aria-hidden /> {t(m.privacy_back)}
          </a>
          <nav
            aria-label={t(m.privacy_language)}
            className="iv-privacy-language"
          >
            <a
              href="?lang=es"
              lang="es"
              aria-current={t.locale === 'es' ? 'page' : undefined}
            >
              {t(m.privacy_language_es)}
            </a>
            <a
              href="?lang=en"
              lang="en"
              aria-current={t.locale === 'en' ? 'page' : undefined}
            >
              {t(m.privacy_language_en)}
            </a>
          </nav>
        </header>
        <main>
          <div className="iv-privacy-intro">
            <h1>{t(m.privacy_title)}</h1>
            <p>{t(m.privacy_intro)}</p>
          </div>
          <section
            className="iv-privacy-controller"
            aria-labelledby="controller"
          >
            <h2 id="controller">{t(m.privacy_controller_title)}</h2>
            <p>{t(m.privacy_controller_detail)}</p>
            {!complete && <p>{t(m.privacy_incomplete)}</p>}
            {controller && (
              <address>
                <strong>{controller.name}</strong>
                <span>
                  {t(m.privacy_tax_id)}: {controller.taxId}
                </span>
                <span>
                  {t(m.privacy_address)}:{' '}
                  {formatAddress(controller.address).join(', ')}
                </span>
                {controller.email && (
                  <a
                    href={`mailto:${controller.email}`}
                    aria-label={`${t(m.privacy_email)}: ${controller.email}`}
                  >
                    {controller.email}
                  </a>
                )}
              </address>
            )}
          </section>
          <div className="iv-privacy-reading">
            <nav
              className="iv-privacy-contents"
              aria-label={t(m.privacy_contents)}
            >
              {sections.map(({ id, title }) => (
                <a href={`#${id}`} key={id}>
                  {t(title)}
                </a>
              ))}
            </nav>
            <div className="iv-privacy-body">
              <section aria-labelledby="purposes">
                <h2 id="purposes">{t(m.privacy_purposes_title)}</h2>
                {purposes.map(([title, body]) => (
                  <div key={t(title)}>
                    <h3>{t(title)}</h3>
                    <p>{t(body)}</p>
                  </div>
                ))}
              </section>
              <section aria-labelledby="data">
                <h2 id="data">{t(m.privacy_data_title)}</h2>
                <p>{t(m.privacy_data)}</p>
                <p>{t(m.privacy_evidence)}</p>
              </section>
              <section aria-labelledby="recipients">
                <h2 id="recipients">{t(m.privacy_recipients_title)}</h2>
                <p>{t(m.privacy_recipients_intro)}</p>
                <ul>
                  {[
                    m.privacy_vercel,
                    m.privacy_cloudflare,
                    m.privacy_neon,
                    m.privacy_resend,
                    m.privacy_stripe,
                    m.privacy_photon,
                  ].map((message) => (
                    <li key={t(message)}>{t(message)}</li>
                  ))}
                </ul>
                <p>{t(m.privacy_authorities)}</p>
              </section>
              <section aria-labelledby="transfers">
                <h2 id="transfers">{t(m.privacy_transfers_title)}</h2>
                <p>{t(m.privacy_transfers)}</p>
              </section>
              <section aria-labelledby="retention">
                <h2 id="retention">{t(m.privacy_retention_title)}</h2>
                <ul>
                  {[
                    m.privacy_keep_invoices,
                    m.privacy_keep_quotes,
                    m.privacy_keep_access,
                    m.privacy_keep_logs,
                    m.privacy_keep_backups,
                    m.privacy_keep_rights,
                  ].map((message) => (
                    <li key={t(message)}>{t(message)}</li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="rights">
                <h2 id="rights">{t(m.privacy_rights_title)}</h2>
                <p>{t(m.privacy_rights)}</p>
                <p>{t(m.privacy_complaint)}</p>
                {controller?.email && (
                  <a
                    className="iv-privacy-contact"
                    href={`mailto:${controller.email}`}
                  >
                    {t(m.privacy_contact_action)}{' '}
                    <ArrowUpRight size={16} aria-hidden />
                  </a>
                )}
              </section>
              <section aria-labelledby="required">
                <h2 id="required">{t(m.privacy_required_title)}</h2>
                <p>{t(m.privacy_required)}</p>
                <p>{t(m.privacy_automated)}</p>
              </section>
              <section aria-labelledby="cookies">
                <h2 id="cookies">{t(m.privacy_cookies_title)}</h2>
                <p>{t(m.privacy_cookies)}</p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

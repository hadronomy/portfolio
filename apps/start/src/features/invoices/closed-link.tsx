import type { Locale, Sentence } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { locales, setLocale } from '@portfolio/i18n/runtime';
import { ArrowRight } from 'lucide-react';
import { Speak, useT } from '../../lib/i18n';
import './invoices.css';

// What a customer sees when a link leads nowhere: the ticket they expected,
// stamped closed, its stub torn off. No document means no cover art, so
// the page is the plain paper of the workspace. It cannot know whose link
// it was, so it speaks the language of the last document this browser
// read, or Spanish, and offers the other one.

export function ClosedLink({
  language,
  ...props
}: {
  language: Locale;
  kind: 'quote' | 'invoice';
  title: Sentence;
  detail: Sentence;
  /** Somewhere useful to go instead, when there is one. */
  action?: { readonly href: string; readonly label: Sentence };
}) {
  return (
    <Speak locale={language}>
      <Closed {...props} />
    </Speak>
  );
}

function Closed({
  kind,
  title,
  detail,
  action,
}: Omit<Parameters<typeof ClosedLink>[0], 'language'>) {
  const t = useT();
  const other = locales.find((locale) => locale !== t.locale) ?? t.locale;
  return (
    <div className="iv-closed" lang={t.locale}>
      <main className="iv-closed-main">
        <div className="iv-closed-ticket" aria-hidden>
          <div className="iv-closed-face">
            <span>{t(m.doc_kind, { kind })}</span>
            <span className="iv-pay-stamp iv-closed-stamp">
              {t(m.closed_stamp)}
            </span>
          </div>
          <div className="iv-closed-stub" />
        </div>
        <h1>{t(title)}</h1>
        <p>{t(detail)}</p>
        {action && (
          <a className="iv-btn" data-variant="secondary" href={action.href}>
            <span>{t(action.label)}</span>
            <ArrowRight size={14} aria-hidden />
          </a>
        )}
      </main>
      <footer className="iv-closed-foot">
        <a href="/">hadronomy.com</a>
        <button type="button" lang={other} onClick={() => setLocale(other)}>
          {t(m.language_switch)}
        </button>
      </footer>
    </div>
  );
}

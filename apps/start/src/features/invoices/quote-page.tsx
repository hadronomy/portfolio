import { calculate, formatMoney } from '@portfolio/invoices/calculate';
import type {
  Invoice,
  QuoteResponse,
  QuoteState,
} from '@portfolio/invoices/model';
import { hasPages } from '@portfolio/invoices/pages';
import { quoteNotices } from '@portfolio/invoices/quote-notices';
import { useRouter } from '@tanstack/react-router';
import { Check, ChevronDown, Download, Hourglass, Mail, X } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { answerQuoteLink } from './api';
import { coverArt } from './covers';
import { PageView } from './page-view';
import { longDate } from './pay-words';
import { type QuoteWords, quoteWords } from './quote-words';
import { Button, MorphText } from './ui';
import './invoices.css';

// The customer's page for one quote, behind its link: the quote itself on
// the ticket, the answer on the stub below it. The customer reads it whole
// (the lines, the proposal, the conditions, the legal information) before
// the form lets them sign, and the answer names the exact PDF they read.

const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (day: string) =>
  Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) /
      86_400_000,
  );

function Note({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="iv-pay-note" aria-live="polite">
      <span className="iv-pay-note-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

function Document({
  quote,
  token,
  t,
}: {
  quote: Invoice;
  token: string;
  t: QuoteWords;
}) {
  const d = quote.data;
  const totals = calculate(d);
  const money = (value: string) => formatMoney(value, d.language, d.currency);
  const legal = d.quote ? quoteNotices(d, d.quote, d.language) : [];
  return (
    <article className="iv-pay-doc">
      {d.cover !== 'none' && (
        <img className="iv-pay-banner" src={coverArt[d.cover].banner} alt="" />
      )}
      <header className="iv-pay-head">
        <div>
          <p className="iv-pay-issuer">{d.issuer.name}</p>
          <h1>
            {t.quote} <span className="iv-num">{quote.number}</span>
          </h1>
        </div>
        <a
          className="iv-pay-pdf"
          href={`/invoices/quote/${token}/pdf?lang=${d.language}`}
          download
          aria-label={t.pdfLabel}
        >
          <Download size={14} aria-hidden />
          {t.pdf}
        </a>
      </header>
      {d.title && <p className="iv-pay-title">{d.title}</p>}
      <div className="iv-pay-lines">
        <ul>
          {d.lines.map((line, index) =>
            line.kind === 'note' ? null : (
              <li key={line.id}>
                <span>{line.description}</span>
                <span className="iv-num">
                  {money(totals.lines[index]?.net ?? '0')}
                </span>
              </li>
            ),
          )}
        </ul>
      </div>
      <dl className="iv-pay-totals">
        <div>
          <dt>{t.total}</dt>
          <dd className="iv-num">{money(totals.total)}</dd>
        </div>
      </dl>
      {d.quote && hasPages(d.quote.pages) && (
        <section className="iv-quote-pages" aria-label={t.pages}>
          <PageView pages={d.quote.pages} language={d.language} />
        </section>
      )}
      {legal.length > 0 && (
        <details className="iv-quote-legal">
          <summary>
            {t.legal}
            <ChevronDown size={15} aria-hidden />
          </summary>
          <dl>
            {legal.map((notice) => (
              <div key={notice.id}>
                <dt>{notice.title}</dt>
                <dd>
                  <p>{notice.body}</p>
                  <p className="iv-prose-source">{notice.source}</p>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}

function Answer({
  quote,
  token,
  digest,
  t,
}: {
  quote: Invoice;
  token: string;
  digest: string;
  t: QuoteWords;
}) {
  const router = useRouter();
  const d = quote.data;
  const consumer = d.customerType === 'consumer';
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [earlyStart, setEarlyStart] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [pending, setPending] = useState<'accepted' | 'declined' | null>(null);
  const [problem, setProblem] = useState<'stale' | 'failed' | null>(null);
  const nameId = useId();
  const ready = name.trim().length >= 2;

  const send = async (outcome: 'accepted' | 'declined') => {
    setPending(outcome);
    setProblem(null);
    try {
      const result = await answerQuoteLink({
        data: {
          token,
          answer: {
            outcome,
            name: name.trim(),
            earlyStart: outcome === 'accepted' && earlyStart,
            language: d.language,
            digest,
          },
        },
      });
      if (!result.ok) {
        setProblem(result.reason === 'stale-document' ? 'stale' : 'failed');
        return;
      }
      await router.invalidate();
    } catch {
      setProblem('failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <form
      className="iv-quote-answer"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && agreed) void send('accepted');
      }}
    >
      <label className="iv-quote-name" htmlFor={nameId}>
        <span>{t.name}</span>
        <input
          id={nameId}
          className="iv-input"
          autoComplete="name"
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
        />
      </label>
      <label className="iv-check iv-quote-check">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>{t.agree}</span>
      </label>
      {consumer && (
        <label className="iv-check iv-quote-check">
          <input
            type="checkbox"
            checked={earlyStart}
            onChange={(event) => setEarlyStart(event.target.checked)}
          />
          <span>
            {t.earlyStart}
            <small>{t.earlyStartDetail}</small>
          </span>
        </label>
      )}
      {problem && (
        <Note
          icon={<Hourglass size={16} />}
          title={problem === 'stale' ? t.stale : t.failed}
        >
          {problem === 'stale' && (
            <Button size="sm" onClick={() => router.invalidate()}>
              {t.reload}
            </Button>
          )}
        </Note>
      )}
      <Button
        type="submit"
        variant="primary"
        className="iv-quote-accept"
        disabled={!ready || !agreed || pending !== null}
      >
        <MorphText>{pending === 'accepted' ? t.accepting : t.accept}</MorphText>
      </Button>
      <p className="iv-quote-fine">
        {t.signature}{' '}
        <span className="iv-num" title={digest}>
          {t.fingerprint} {digest.slice(0, 12)}
        </span>
      </p>
      {declining ? (
        <fieldset className="iv-quote-decline">
          <legend>{t.declineConfirm(d.issuer.name)}</legend>
          <div>
            <Button
              size="sm"
              disabled={!ready || pending !== null}
              onClick={() => void send('declined')}
            >
              <span>{t.declineYes}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeclining(false)}
            >
              <span>{t.declineNo}</span>
            </Button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          className="iv-quote-decline-open"
          onClick={() => setDeclining(true)}
        >
          {t.decline}
        </button>
      )}
    </form>
  );
}

function Answered({ response, t }: { response: QuoteResponse; t: QuoteWords }) {
  const day = longDate(response.language, response.decidedAt.slice(0, 10));
  const accepted = response.outcome === 'accepted';
  return (
    <Note
      icon={accepted ? <Check size={16} /> : <X size={16} />}
      title={
        accepted
          ? t.accepted(response.name, day)
          : t.declined(response.name, day)
      }
    >
      {response.confirmedAt && <p>{t.emailed(response.email)}</p>}
      {response.earlyStart && <p>{t.earlyStarted}</p>}
    </Note>
  );
}

export function QuotePage({
  token,
  quote,
  response,
  state,
  digests,
}: {
  token: string;
  quote: Invoice;
  response: QuoteResponse | null;
  state: QuoteState;
  digests: Readonly<Record<'en' | 'es', string>>;
}) {
  const d = quote.data;
  const t = quoteWords[d.language];
  const money = (value: string) => formatMoney(value, d.language, d.currency);
  const total = calculate(d).total;
  const until = d.quote?.validUntil ?? d.issueDate;
  const left = daysUntil(until);
  const stubId = useId();
  const accepted = state === 'accepted' || state === 'invoiced';
  return (
    <div className="iv-pay">
      <div className="iv-backdrop" aria-hidden>
        <img
          src={coverArt[d.cover === 'none' ? 'ember' : d.cover].backdrop}
          alt=""
          data-active="true"
        />
      </div>
      <main className="iv-pay-ticket" lang={d.language}>
        <Document quote={quote} token={token} t={t} />
        <section className="iv-pay-stub" aria-labelledby={stubId}>
          <div className="iv-pay-due">
            <span id={stubId}>{t.total}</span>
            <strong className="iv-num">{money(total)}</strong>
            <span data-tone={state === 'expired' ? 'late' : undefined}>
              {t.validUntil(longDate(d.language, until))}
              {state === 'open' && ` · ${t.daysLeft(Math.max(left, 0))}`}
            </span>
            {accepted && (
              <span className="iv-pay-stamp" aria-hidden>
                {t.stampAccepted}
              </span>
            )}
          </div>
          {response ? (
            <Answered response={response} t={t} />
          ) : state === 'expired' ? (
            <Note
              icon={<Hourglass size={16} />}
              title={t.expired(longDate(d.language, until))}
            >
              <p>{t.expiredDetail(d.issuer.name)}</p>
              {d.issuer.email && (
                <a
                  className="iv-btn"
                  data-variant="secondary"
                  data-size="sm"
                  href={`mailto:${d.issuer.email}?subject=${encodeURIComponent(`${t.quote} ${quote.number}`)}`}
                >
                  <Mail size={14} aria-hidden />
                  <span>{t.write(d.issuer.email)}</span>
                </a>
              )}
            </Note>
          ) : (
            <Answer
              quote={quote}
              token={token}
              digest={digests[d.language]}
              t={t}
            />
          )}
        </section>
      </main>
      <footer className="iv-pay-foot">
        {d.issuer.email && (
          <a href={`mailto:${d.issuer.email}`}>{d.issuer.email}</a>
        )}
      </footer>
    </div>
  );
}

/** A link that does not open a quote. It cannot know the language, so it asks in both. */
export function InvalidQuoteLinkPage() {
  return (
    <div className="iv-pay">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.ember.backdrop} alt="" data-active="true" />
      </div>
      <main className="iv-pay-ticket" data-plain>
        <article className="iv-pay-doc">
          {(['en', 'es'] as const).map((language) => (
            <div key={language} className="iv-pay-gone" lang={language}>
              <h1>{quoteWords[language].invalid}</h1>
              <p>{quoteWords[language].invalidDetail}</p>
            </div>
          ))}
        </article>
      </main>
    </div>
  );
}

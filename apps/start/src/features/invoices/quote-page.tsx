import type { Translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { bills, planTerms } from '@portfolio/invoices/billing';
import { calculate, formatMoney } from '@portfolio/invoices/calculate';
import type { Invoice, Language } from '@portfolio/invoices/model';
import { hasPages } from '@portfolio/invoices/pages';
import type { PaymentPlan } from '@portfolio/invoices/plan';
import {
  type QuoteResponse,
  type QuoteState,
  signatureSource,
} from '@portfolio/invoices/quote-model';
import { quoteNotices } from '@portfolio/invoices/quote-notices';
import { useRouter } from '@tanstack/react-router';
import { Check, ChevronDown, Download, Hourglass, Mail, X } from 'lucide-react';
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  type InkStroke,
  type PadWords,
  SignaturePad,
  signatureToSvg,
} from '../../components/arc/signature-pad/signature-pad';
import { Speak, useT } from '../../lib/i18n';
import { answerQuoteLink } from './api';
import { ClosedLink } from './closed-link';
import { coverArt } from './covers';
import { PageView } from './page-view';
import { Button, MorphText } from './ui';
import './invoices.css';

// The customer's page for one quote, behind its link. They read the PDF
// itself, page by page, and answer on a ticket: its face says what the
// quote costs and until when, and the slip below the perforation is where
// they sign. On a wide screen the ticket stands beside the pages; on a
// phone it waits docked at the foot of the screen, face up, and pulls up
// over the pages to be signed. The answer names the exact PDF they read.

/** What the signature pad says to a screen reader, in the page's language. */
const padWords = (t: Translate): PadWords => ({
  undo: t(m.pad_undo),
  redo: t(m.pad_redo),
  clear: t(m.pad_clear),
  state: (strokes) => t(m.pad_state, { strokes }),
  keys: t(m.pad_keys),
  added: (strokes) => t(m.pad_added, { strokes }),
  undone: t(m.pad_undone),
  redone: t(m.pad_redone),
  cleared: t(m.pad_cleared),
});

const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (day: string) =>
  Math.round(
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) /
      86_400_000,
  );

/** The page images are rendered at this many pixels per PDF point. */
const pageScale = 2.25;

/** Where the ticket stops standing beside the pages and docks instead. */
const narrow = '(max-width: 899px)';
function useNarrow() {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(narrow);
      query.addEventListener('change', change);
      return () => query.removeEventListener('change', change);
    },
    () => window.matchMedia(narrow).matches,
    () => false,
  );
}

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

/** What the PDF is, for the customer who cannot see its pages: the same lines, pages and notices. */
function TextVersion({ quote }: { quote: Invoice }) {
  const t = useT();
  const d = quote.data;
  const totals = calculate(d);
  const money = (value: string) => formatMoney(value, d.language, d.currency);
  const legal = d.quote ? quoteNotices(d, d.quote, d.language) : [];
  return (
    <details className="iv-quote-text">
      <summary>
        {t(m.quote_as_text)}
        <ChevronDown size={15} aria-hidden />
      </summary>
      <div className="iv-quote-text-body">
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
            <dt>{t(m.quote_total)}</dt>
            <dd className="iv-num">{money(totals.total)}</dd>
          </div>
        </dl>
        {d.quote && hasPages(d.quote.pages) && (
          <section className="iv-quote-pages" aria-label={t(m.quote_pages)}>
            <PageView pages={d.quote.pages} language={d.language} />
          </section>
        )}
        {legal.length > 0 && (
          <section className="iv-quote-legal" aria-label={t(m.quote_legal)}>
            <h2>{t(m.quote_legal)}</h2>
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
          </section>
        )}
      </div>
    </details>
  );
}

/** The PDF's pages as the server renders them, stacked like paper. */
function Sheets({
  token,
  language,
  sheets,
}: {
  token: string;
  language: Invoice['data']['language'];
  sheets: QuotePageProps['sheets'];
}) {
  const t = useT();
  const width = Math.round(sheets.width * pageScale);
  const height = Math.round(sheets.height * pageScale);
  return (
    <ol className="iv-quote-sheets">
      {Array.from({ length: sheets.count }, (_, index) => (
        <li key={`${sheets.digest}-${index}`}>
          <img
            src={`/invoices/quote/${token}/pages/${index + 1}?lang=${language}&v=${sheets.digest}`}
            width={width}
            height={height}
            alt={t(m.quote_page_of, { page: index + 1, pages: sheets.count })}
            // The first two fill the first screen; the rest wait until the
            // customer reads towards them.
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </li>
      ))}
    </ol>
  );
}

/**
 * The plans the quote offers, as the customer chooses between them: each
 * as one sentence, with what the first payment comes to if they accept now.
 */
function Plans({
  quote,
  plans,
  chosen,
  onChoose,
}: {
  quote: Invoice;
  plans: readonly PaymentPlan[];
  chosen: PaymentPlan['id'] | null;
  onChoose: (plan: PaymentPlan['id']) => void;
}) {
  const t = useT();
  const d = quote.data;
  const now = today();
  const words = (plan: PaymentPlan) => planTerms(plan, d.language, d.currency);
  const first = (plan: PaymentPlan) => {
    const [payment] = bills(d, plan, now);
    if (!payment) return null;
    return {
      amount: formatMoney(payment.amount, d.language, d.currency),
      when:
        payment.date <= now
          ? t(m.quote_on_acceptance)
          : t(m.date_long, { date: payment.date }),
    };
  };
  const [only] = plans;
  if (plans.length === 1 && only)
    return (
      <div className="iv-quote-plan">
        <span>{t(m.quote_paying)}</span>
        <p>{words(only)}</p>
      </div>
    );
  return (
    <fieldset className="iv-pay-options iv-pay-plans iv-quote-plans">
      <legend>{t(m.quote_how_you_pay)}</legend>
      {plans.map((plan, index) => {
        const opening = first(plan);
        return (
          <label key={plan.id} data-checked={plan.id === chosen}>
            <input
              type="radio"
              name="plan"
              checked={plan.id === chosen}
              onChange={() => onChoose(plan.id)}
            />
            <span className="iv-pay-option-what">
              <strong>
                {plan.name || t(m.quote_option, { index: index + 1 })}
              </strong>
              <span>{words(plan)}</span>
            </span>
            {opening && (
              <span className="iv-pay-plan-now">
                <span className="iv-num">{opening.amount}</span>
                <small>{opening.when}</small>
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function Answer({
  quote,
  token,
  digest,
  plans,
  onAnswered,
}: {
  quote: Invoice;
  token: string;
  digest: string;
  plans: readonly PaymentPlan[];
  onAnswered: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const d = quote.data;
  const consumer = d.customerType === 'consumer';
  const [name, setName] = useState('');
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [earlyStart, setEarlyStart] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [pending, setPending] = useState<'accepted' | 'declined' | null>(null);
  const [problem, setProblem] = useState<'stale' | 'failed' | null>(null);
  const [plan, setPlan] = useState<PaymentPlan['id'] | null>(
    plans[0]?.id ?? null,
  );
  const nameId = useId();
  const named = name.trim().length >= 2;
  const signed = strokes.length > 0;

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
            plan: plans.length > 1 ? plan : null,
            signature: outcome === 'accepted' ? signatureToSvg(strokes) : null,
          },
        },
      });
      if (!result.ok) {
        setProblem(result.reason === 'stale-document' ? 'stale' : 'failed');
        return;
      }
      onAnswered();
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
        if (named && signed && agreed) void send('accepted');
      }}
    >
      <Plans quote={quote} plans={plans} chosen={plan} onChoose={setPlan} />
      <label className="iv-quote-name" htmlFor={nameId}>
        <span>{t(m.quote_name)}</span>
        <input
          id={nameId}
          className="iv-input"
          autoComplete="name"
          placeholder={t(m.quote_name_placeholder)}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
        />
      </label>
      <fieldset className="iv-quote-sign">
        <legend>{t(m.quote_sign)}</legend>
        <SignaturePad
          variant="field"
          className="iv-signature"
          defaultColor="blue"
          signer={name.trim()}
          hint={t(m.quote_sign_hint)}
          label={t(m.quote_sign)}
          words={padWords(t)}
          onChange={setStrokes}
        />
      </fieldset>
      <label className="iv-check iv-quote-check">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>{t(m.quote_agree)}</span>
      </label>
      {consumer && (
        <label className="iv-check iv-quote-check">
          <input
            type="checkbox"
            checked={earlyStart}
            onChange={(event) => setEarlyStart(event.target.checked)}
          />
          <span>
            {t(m.quote_early_start)}
            <small>{t(m.quote_early_start_detail)}</small>
          </span>
        </label>
      )}
      {problem && (
        <Note
          icon={<Hourglass size={16} />}
          title={t(problem === 'stale' ? m.quote_stale : m.quote_failed)}
        >
          {problem === 'stale' && (
            <Button size="sm" onClick={() => router.invalidate()}>
              {t(m.quote_reload)}
            </Button>
          )}
        </Note>
      )}
      <Button
        type="submit"
        variant="primary"
        className="iv-quote-accept"
        disabled={!named || !signed || !agreed || pending !== null}
      >
        <MorphText>
          {t(pending === 'accepted' ? m.quote_accepting : m.quote_accept)}
        </MorphText>
      </Button>
      <p className="iv-quote-fine">
        {t(m.quote_signature)}{' '}
        <span className="iv-num" title={digest}>
          {t(m.quote_fingerprint)} {digest.slice(0, 12)}
        </span>
      </p>
      {declining ? (
        <fieldset className="iv-quote-decline">
          <legend>
            {t(m.quote_decline_confirm, { issuer: d.issuer.name })}
          </legend>
          <div>
            <Button
              size="sm"
              disabled={!named || pending !== null}
              onClick={() => void send('declined')}
            >
              <span>{t(m.quote_decline_yes)}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeclining(false)}
            >
              <span>{t(m.quote_decline_no)}</span>
            </Button>
          </div>
        </fieldset>
      ) : (
        <button
          type="button"
          className="iv-quote-decline-open"
          onClick={() => setDeclining(true)}
        >
          {t(m.quote_decline)}
        </button>
      )}
    </form>
  );
}

function Answered({
  response,
  currency,
  live,
}: {
  response: QuoteResponse;
  currency: Invoice['data']['currency'];
  /** The answer was given on this page just now, so its stamp falls. */
  live: boolean;
}) {
  const t = useT();
  const date = response.decidedAt.slice(0, 10);
  const accepted = response.outcome === 'accepted';
  return (
    <div className="iv-quote-answered">
      {response.signature && (
        <figure className="iv-quote-signed">
          <img
            src={signatureSource(response.signature)}
            alt={t(m.quote_signed_by, { name: response.name })}
          />
          <figcaption>
            <strong>{response.name}</strong>
            <span>{t(m.date_long, { date })}</span>
          </figcaption>
          {accepted && (
            <span
              className="iv-pay-stamp"
              data-live={live || undefined}
              aria-hidden
            >
              {t(m.quote_stamp_accepted)}
            </span>
          )}
        </figure>
      )}
      <Note
        icon={accepted ? <Check size={16} /> : <X size={16} />}
        title={t(accepted ? m.quote_accepted : m.quote_declined, {
          name: response.name,
          date,
        })}
      >
        {response.plan && (
          <p>{planTerms(response.plan, response.language, currency)}</p>
        )}
        {response.confirmedAt && (
          <p>{t(m.quote_emailed, { email: response.email })}</p>
        )}
        {response.earlyStart && <p>{t(m.quote_early_started)}</p>}
      </Note>
    </div>
  );
}

/**
 * The ticket's motion on a phone: docked with its face showing, or pulled
 * up over the pages. A drag follows the finger; on release a short flick
 * is enough, or half the way, and a tap on the face toggles it.
 */
function useDock(
  ticket: RefObject<HTMLElement | null>,
  face: RefObject<HTMLElement | null>,
  docked: boolean,
) {
  const [open, setOpen] = useState(false);
  const drag = useRef<{
    id: number;
    y: number;
    at: number;
    from: number;
    moved: boolean;
  } | null>(null);

  // How far down a docked ticket sits, so only its face shows; and on a
  // wide screen, where it sticks: at the top while it fits the screen, at
  // its foot once it is taller, so its last line can always be reached.
  useEffect(() => {
    const node = ticket.current;
    const top = face.current;
    if (!node || !top) return;
    const measure = () => {
      // The room reads it too, to leave the docked face room at the end.
      for (const holder of [node, node.parentElement])
        holder?.style.setProperty('--face', `${top.offsetHeight}px`);
      node.style.setProperty(
        '--stick',
        `${Math.min(24, window.innerHeight - node.offsetHeight - 24)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(top);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ticket, face]);

  useEffect(() => {
    if (!docked) setOpen(false);
  }, [docked]);

  // Pulled up, the ticket is the page: what is behind it neither scrolls
  // nor takes focus, and Escape lays it back down.
  useEffect(() => {
    if (!docked || !open) return;
    const root = document.documentElement;
    const paper = document.querySelector<HTMLElement>('.iv-quote-paper');
    root.style.overflow = 'hidden';
    paper?.setAttribute('inert', '');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = '';
      paper?.removeAttribute('inert');
      window.removeEventListener('keydown', onKey);
    };
  }, [docked, open]);

  const closedOffset = () =>
    (ticket.current?.offsetHeight ?? 0) - (face.current?.offsetHeight ?? 0);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!docked || drag.current) return;
    // Its button and link answer taps of their own.
    if ((event.target as HTMLElement).closest('a, button')) return;
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      at: event.timeStamp,
      from: open ? 0 : closedOffset(),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    const node = ticket.current;
    if (!current || current.id !== event.pointerId || !node) return;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.abs(dy) < 4) return;
    current.moved = true;
    const raw = current.from + dy;
    // Past either end it gives a little, then less and less.
    const limit = closedOffset();
    const y =
      raw < 0
        ? -Math.sqrt(-raw) * 2
        : raw > limit
          ? limit + Math.sqrt(raw - limit) * 2
          : raw;
    node.style.transition = 'none';
    node.style.transform = `translateY(${y}px)`;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    const node = ticket.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (node) {
      node.style.transition = '';
      node.style.transform = '';
    }
    if (!current.moved) {
      setOpen((was) => !was);
      return;
    }
    const dy = event.clientY - current.y;
    const speed = dy / Math.max(1, event.timeStamp - current.at);
    const half = closedOffset() / 2;
    if (open) setOpen(!(dy > half || speed > 0.11));
    else setOpen(-dy > half || speed < -0.11);
  };

  return {
    open,
    setOpen,
    grip: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

interface QuotePageProps {
  token: string;
  quote: Invoice;
  response: QuoteResponse | null;
  state: QuoteState;
  digests: Readonly<Record<'en' | 'es', string>>;
  plans: readonly PaymentPlan[];
  sheets: {
    readonly count: number;
    readonly width: number;
    readonly height: number;
    readonly digest: string;
  };
}

export function QuotePage(props: QuotePageProps) {
  return (
    <Speak locale={props.quote.data.language} remember>
      <QuoteRoom {...props} />
    </Speak>
  );
}

function QuoteRoom({
  token,
  quote,
  response,
  state,
  digests,
  plans,
  sheets,
}: QuotePageProps) {
  const t = useT();
  const d = quote.data;
  const money = (value: string) => formatMoney(value, d.language, d.currency);
  const total = calculate(d).total;
  const until = d.quote?.validUntil ?? d.issueDate;
  const left = daysUntil(until);
  const faceId = useId();
  const accepted = response?.outcome === 'accepted';
  // The stamp falls only when it is pressed in front of the customer.
  const [justAnswered, setJustAnswered] = useState(false);
  const docked = useNarrow();
  const ticket = useRef<HTMLElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const dock = useDock(ticket, face, docked);
  return (
    <div className="iv-pay iv-quote-room" lang={d.language}>
      <div className="iv-backdrop" aria-hidden>
        <img
          src={coverArt[d.cover === 'none' ? 'ember' : d.cover].backdrop}
          alt=""
          data-active="true"
        />
      </div>
      <main className="iv-quote-paper">
        <header className="iv-quote-top">
          <p>
            <strong>{d.issuer.name}</strong>
            <span>
              {t(m.quote_quote)} <span className="iv-num">{quote.number}</span>{' '}
              · {t(m.quote_page_count, { count: sheets.count })}
            </span>
          </p>
          <a
            className="iv-pay-pdf"
            href={`/invoices/quote/${token}/pdf?lang=${d.language}`}
            download
            aria-label={t(m.quote_pdf_label)}
          >
            <Download size={14} aria-hidden />
            {t(m.quote_pdf)}
          </a>
        </header>
        <Sheets token={token} language={d.language} sheets={sheets} />
        <TextVersion quote={quote} />
        {d.issuer.email && (
          <footer className="iv-quote-foot">
            <a href={`mailto:${d.issuer.email}`}>{d.issuer.email}</a>
          </footer>
        )}
      </main>
      {docked && (
        <div
          className="iv-quote-scrim"
          data-open={dock.open || undefined}
          aria-hidden
          onClick={() => dock.setOpen(false)}
        />
      )}
      <aside
        ref={ticket}
        className="iv-quote-ticket"
        aria-labelledby={faceId}
        data-docked={docked || undefined}
        data-open={dock.open || undefined}
      >
        <div ref={face} className="iv-quote-face" {...dock.grip}>
          {docked && <span className="iv-quote-grip" aria-hidden />}
          <p className="iv-quote-number" id={faceId}>
            {t(m.quote_quote)} <span className="iv-num">{quote.number}</span>
          </p>
          {d.title && <p className="iv-quote-title">{d.title}</p>}
          <div className="iv-pay-due">
            <span>{t(m.quote_total)}</span>
            <strong className="iv-num">{money(total)}</strong>
            {response ? (
              <span data-tone={accepted ? 'done' : undefined}>
                {t(accepted ? m.quote_accepted_on : m.quote_declined_on, {
                  date: response.decidedAt.slice(0, 10),
                })}
              </span>
            ) : (
              <span data-tone={state === 'expired' ? 'late' : undefined}>
                {/* Docked, the face has one short line to spare. */}
                {docked && state === 'open'
                  ? t(m.quote_days_left, { count: Math.max(left, 0) })
                  : t(m.quote_valid_until, { date: until })}
                {!docked &&
                  state === 'open' &&
                  ` · ${t(m.quote_days_left, { count: Math.max(left, 0) })}`}
              </span>
            )}
          </div>
          {docked && (
            <Button
              variant={
                dock.open || response || state === 'expired'
                  ? 'secondary'
                  : 'primary'
              }
              className="iv-quote-open"
              aria-expanded={dock.open}
              onClick={() => dock.setOpen(!dock.open)}
            >
              <MorphText>
                {t(
                  dock.open
                    ? m.quote_back
                    : response || state === 'expired'
                      ? m.quote_answer
                      : m.quote_review,
                )}
              </MorphText>
            </Button>
          )}
        </div>
        <section
          className="iv-quote-slip"
          inert={docked && !dock.open ? true : undefined}
        >
          {response ? (
            <Answered
              response={response}
              currency={d.currency}
              live={justAnswered}
            />
          ) : state === 'expired' ? (
            <Note
              icon={<Hourglass size={16} />}
              title={t(m.quote_expired, { date: until })}
            >
              <p>{t(m.quote_expired_detail, { issuer: d.issuer.name })}</p>
              {d.issuer.email && (
                <a
                  className="iv-btn"
                  data-variant="secondary"
                  data-size="sm"
                  href={`mailto:${d.issuer.email}?subject=${encodeURIComponent(`${t(m.quote_quote)} ${quote.number}`)}`}
                >
                  <Mail size={14} aria-hidden />
                  <span>{t(m.quote_write, { email: d.issuer.email })}</span>
                </a>
              )}
            </Note>
          ) : (
            <Answer
              quote={quote}
              token={token}
              digest={digests[d.language]}
              plans={plans}
              onAnswered={() => setJustAnswered(true)}
            />
          )}
        </section>
      </aside>
    </div>
  );
}

/** A quote link that does not open. */
export function InvalidQuoteLinkPage({ language }: { language: Language }) {
  return (
    <ClosedLink
      language={language}
      kind="quote"
      title={m.quote_invalid}
      detail={m.quote_invalid_detail}
    />
  );
}

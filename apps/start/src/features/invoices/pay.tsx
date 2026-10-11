import {
  Checkout,
  type CheckoutInvoice,
  type PlanChoice,
} from '@portfolio/invoices/collection-model';
import { useRouter } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Hourglass,
  Mail,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { CodeSignIn } from '../account/code-sign-in';
import type { Access } from './api';
import { coverArt } from './covers';
import { PayStub } from './pay-form';
import {
  fromCents,
  longDate,
  moneyOf,
  toCents,
  type Words,
  words,
} from './pay-words';
import { partName } from './schedule';
import { Button, MorphText } from './ui';
import './invoices.css';

// The customer's page for one invoice, behind a payment link or in their
// account, drawn as what it is: the invoice, and below it the remittance
// stub that pays it, joined at a perforation. It speaks the invoice's
// language, wears the invoice's own cover, and asks for what its plan says
// is owed now. Whether anything is paid comes from the server, which
// reads Stripe; the browser only reports how the customer's attempt went.

/** Lines shown before the rest fold away: enough to recognise the invoice. */
const visibleLines = 3;

const today = () => new Date().toISOString().slice(0, 10);

function Lines({ invoice, t }: { invoice: CheckoutInvoice; t: Words }) {
  const [all, setAll] = useState(false);
  const money = moneyOf(invoice);
  const hidden = invoice.lines.length - visibleLines;
  const shown =
    all || hidden <= 1 ? invoice.lines : invoice.lines.slice(0, visibleLines);
  return (
    <div className="iv-pay-lines">
      <ul>
        {shown.map((line, index) => (
          <li key={index}>
            <span>
              {line.description}
              {Number(line.quantity) !== 1 && (
                <small className="iv-num">
                  {line.quantity} {line.unit} × {money(line.unitPrice)}
                </small>
              )}
            </span>
            <span className="iv-num">{money(line.amount)}</span>
          </li>
        ))}
      </ul>
      {hidden > 1 && (
        <button
          type="button"
          className="iv-pay-more"
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? t.fewer : t.more(hidden)}
        </button>
      )}
    </div>
  );
}

function Totals({ invoice, t }: { invoice: CheckoutInvoice; t: Words }) {
  const money = moneyOf(invoice);
  const rows: [string, string][] = [[t.subtotal, money(invoice.subtotal)]];
  if (Number(invoice.discount) > 0)
    rows.push([t.discount, money(`-${invoice.discount}`)]);
  for (const tax of invoice.taxes)
    rows.push([`${t.tax} ${Number(tax.rate)}%`, money(tax.amount)]);
  if (Number(invoice.withholding) > 0)
    rows.push([t.withholding, money(`-${invoice.withholding}`)]);
  if (Number(invoice.disbursements) > 0)
    rows.push([t.disbursements, money(invoice.disbursements)]);
  return (
    <dl className="iv-pay-totals">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="iv-num">{value}</dd>
        </div>
      ))}
      <div data-total>
        <dt>{t.total}</dt>
        <dd className="iv-num">{money(invoice.total)}</dd>
      </div>
      {invoice.payments.map((payment, index) => (
        <div key={index} data-received>
          <dt>{t.received(longDate(invoice.language, payment.date))}</dt>
          <dd className="iv-num">{money(`-${payment.amount}`)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Where the invoice's PDF is, for whoever opened the page. */
const pdfOf = (access: Access, invoice: CheckoutInvoice) =>
  `${
    access._tag === 'Link'
      ? `/invoices/pay/${access.token}/pdf`
      : `/invoices/account/pdf/${access.id}`
  }?lang=${invoice.language}`;

/** The invoice itself: who, what, and how the total came to be. */
function Document({
  access,
  invoice,
  t,
}: {
  access: Access;
  invoice: CheckoutInvoice;
  t: Words;
}) {
  return (
    <article className="iv-pay-doc">
      {invoice.cover !== 'none' && (
        <img
          className="iv-pay-banner"
          src={coverArt[invoice.cover].banner}
          alt=""
        />
      )}
      <header className="iv-pay-head">
        <div>
          <p className="iv-pay-issuer">{invoice.issuer}</p>
          <h1>
            {t.invoice} <span className="iv-num">{invoice.number}</span>
          </h1>
        </div>
        <a
          className="iv-pay-pdf"
          href={pdfOf(access, invoice)}
          download
          aria-label={t.pdfLabel}
        >
          <Download size={14} aria-hidden />
          {t.pdf}
        </a>
      </header>
      {invoice.title && <p className="iv-pay-title">{invoice.title}</p>}
      <p className="iv-pay-meta">
        {t.issued(longDate(invoice.language, invoice.issueDate))}
      </p>
      <Lines invoice={invoice} t={t} />
      <Totals invoice={invoice} t={t} />
      {invoice.notes.trim() && (
        <p className="iv-pay-notes">{invoice.notes.trim()}</p>
      )}
      <footer className="iv-pay-parties">
        <Party
          label={t.from}
          name={invoice.issuer}
          lines={invoice.issuerLines}
        />
        <Party
          label={t.billedTo}
          name={invoice.customer}
          lines={invoice.customerLines}
        />
      </footer>
    </article>
  );
}

function Party({
  label,
  name,
  lines,
}: {
  label: string;
  name: string;
  lines: readonly string[];
}) {
  return (
    <address>
      <span>{label}</span>
      <strong>{name}</strong>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </address>
  );
}

function Note({
  icon,
  title,
  children,
  focus = false,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  /** Takes focus when it appears, so a screen reader hears the outcome. */
  focus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div
      ref={ref}
      className="iv-pay-note"
      aria-live="polite"
      tabIndex={focus ? -1 : undefined}
    >
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

/** A payment Stripe has taken and the ledger has not shown yet. */
type Settling = {
  readonly amount: string;
  readonly before: string;
  readonly tries: number;
};

/**
 * The way to an account, beside the ticket rather than on it: an account is
 * the customer's, not part of the invoice.
 */
function Keep({
  invoice,
  account,
  t,
}: {
  invoice: CheckoutInvoice;
  account: AccountOffer;
  t: Words;
}) {
  const router = useRouter();
  const titleId = useId();
  if (account === 'signed-in')
    return (
      <aside className="iv-pay-keep" data-kept>
        <p>
          <Check size={15} strokeWidth={2.2} aria-hidden />
          {t.kept}
        </p>
        <a
          className="iv-btn"
          data-variant="secondary"
          data-size="sm"
          href="/invoices/account"
        >
          <span>{t.allInvoices}</span>
          <ArrowRight size={14} aria-hidden />
        </a>
      </aside>
    );
  return (
    <aside className="iv-pay-keep" aria-labelledby={titleId}>
      <div className="iv-pay-keep-intro">
        <strong id={titleId}>{t.keep}</strong>
        <p>{t.keepDetail(invoice.issuer)}</p>
      </div>
      <CodeSignIn
        language={invoice.language}
        email={invoice.customerEmail}
        emphasis="secondary"
        onSignedIn={() => void router.invalidate()}
      />
    </aside>
  );
}

/** Whether the page offers the customer an account for this invoice's address. */
export type AccountOffer = 'signed-in' | 'offer' | 'unavailable';

/**
 * What the stub leads with. Under a plan of several payments that is the
 * next one, by name and date; otherwise everything still owed, by the due
 * date.
 */
function headline(page: Checkout, plan: PlanChoice | null, t: Words) {
  const { invoice } = page;
  if (plan && plan.schedule.instalments.length > 1) {
    const { instalments } = plan.schedule;
    const index = instalments.findIndex((part) => part.state !== 'paid');
    const part = instalments[index];
    if (part)
      return {
        label: part.state === 'upcoming' ? t.nextPayment : t.dueNow,
        amount: fromCents(toCents(part.amount) - toCents(part.paid)),
        name: partName(t, instalments, index),
        date: part.date,
        late: part.state === 'late',
      };
  }
  return {
    label: t.due,
    amount: invoice.remaining,
    name: null,
    date: invoice.dueDate,
    late: invoice.dueDate < today(),
  };
}

export function PaymentPage({
  access,
  page,
  publishableKey,
  account,
}: {
  access: Access;
  page: Checkout;
  publishableKey: string;
  account: AccountOffer;
}) {
  const { invoice } = page;
  const t = words[invoice.language];
  const money = moneyOf(invoice);
  const router = useRouter();
  const dueId = useId();
  const [settling, setSettling] = useState<Settling | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  // The stamp lands only when the payment happens in front of the customer;
  // a page opened after the fact shows it already on the paper.
  const [stamped, setStamped] = useState(false);

  const onPaid = useCallback(
    (amount: string, settled: boolean) => {
      setThanks(null);
      if (!settled) {
        router.invalidate();
        return;
      }
      setSettling({ amount, before: invoice.remaining, tries: 0 });
    },
    [router, invoice.remaining],
  );

  // Stripe updates the invoice a moment after the payment succeeds, so the
  // page asks again, briefly, until the ledger shows the money.
  useEffect(() => {
    if (!settling) return;
    if (page._tag !== 'Payable' || invoice.remaining !== settling.before) {
      if (page._tag === 'Paid') setStamped(true);
      else setThanks(settling.amount);
      setSettling(null);
      return;
    }
    if (settling.tries >= 8) return;
    const timer = window.setTimeout(
      () => {
        router.invalidate();
        setSettling({ ...settling, tries: settling.tries + 1 });
      },
      600 + settling.tries * 400,
    );
    return () => window.clearTimeout(timer);
  }, [settling, page._tag, invoice.remaining, router]);

  // A payment still clearing answers on its own: look again now and then
  // while the page is in front of someone.
  useEffect(() => {
    if (page._tag !== 'Processing') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.invalidate();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [page._tag, router]);

  // The plan the customer is looking at. A reload that no longer offers it
  // (a payment landed under another, the owner changed the plans) falls
  // back to the one the page opens on.
  const [picked, setPicked] = useState<PlanChoice['id'] | null>(null);
  const plan =
    page._tag === 'Payable'
      ? (page.plans.find((choice) => choice.id === picked) ??
        page.plans.find((choice) => choice.id === page.selected) ??
        page.plans[0] ??
        null)
      : null;

  const paid = page._tag === 'Paid';
  const lastPayment = invoice.payments.at(-1)?.date;
  const lead = headline(page, plan, t);

  return (
    <div className="iv-pay">
      <div className="iv-backdrop" aria-hidden>
        <img
          src={
            coverArt[invoice.cover === 'none' ? 'ember' : invoice.cover]
              .backdrop
          }
          alt=""
          data-active="true"
        />
      </div>
      {access._tag === 'Account' && (
        <a href="/invoices/account" className="iv-pay-back">
          <ArrowLeft size={15} aria-hidden />
          {t.allInvoices}
        </a>
      )}
      <main className="iv-pay-ticket" lang={invoice.language}>
        <Document access={access} invoice={invoice} t={t} />
        <section className="iv-pay-stub" aria-labelledby={dueId}>
          <div className="iv-pay-due">
            <span id={dueId}>{paid ? t.amountPaid : lead.label}</span>
            <strong className="iv-num">
              <MorphText>{money(paid ? invoice.total : lead.amount)}</MorphText>
            </strong>
            {!paid && (
              <span data-tone={lead.late ? 'late' : undefined}>
                {lead.name && `${lead.name} · `}
                {(lead.late ? t.overdue : t.dueOn)(
                  longDate(invoice.language, lead.date),
                )}
              </span>
            )}
            {paid && (
              <span
                className="iv-pay-stamp"
                data-live={stamped || undefined}
                aria-hidden
              >
                {t.stamp}
              </span>
            )}
          </div>
          {Checkout.match(page, {
            Payable: ({ plans, locked }) => (
              <>
                {thanks && (
                  <Note
                    icon={<Check size={16} />}
                    title={t.thanks(money(thanks))}
                    focus
                  />
                )}
                {settling && settling.tries >= 8 && (
                  <Note icon={<Hourglass size={16} />} title={t.settling} />
                )}
                {plan && (
                  <PayStub
                    access={access}
                    invoice={invoice}
                    plans={plans}
                    plan={plan}
                    locked={locked}
                    onPlan={setPicked}
                    publishableKey={publishableKey}
                    onPaid={onPaid}
                  />
                )}
              </>
            ),
            Processing: ({ amount }) => (
              <Note
                icon={<Hourglass size={16} />}
                title={t.processing(money(amount))}
              >
                <p>{t.processingDetail}</p>
                <Button size="sm" onClick={() => router.invalidate()}>
                  {t.check}
                </Button>
              </Note>
            ),
            Paid: () => (
              <Note icon={<Check size={16} />} title={t.paid} focus={stamped}>
                {lastPayment && (
                  <p>{t.paidOn(longDate(invoice.language, lastPayment))}</p>
                )}
              </Note>
            ),
            Unavailable: () => (
              <Note icon={<Hourglass size={16} />} title={t.paused}>
                <p>{t.pausedDetail(invoice.issuer)}</p>
                {invoice.issuerEmail && (
                  <a
                    className="iv-btn"
                    data-variant="secondary"
                    data-size="sm"
                    href={`mailto:${invoice.issuerEmail}?subject=${encodeURIComponent(`${t.invoice} ${invoice.number}`)}`}
                  >
                    <Mail size={14} aria-hidden />
                    <span>{t.write(invoice.issuerEmail)}</span>
                  </a>
                )}
              </Note>
            ),
          })}
        </section>
      </main>
      {/* In the account the invoice is already kept; the way back is above. */}
      {access._tag === 'Link' && account !== 'unavailable' && (
        <Keep invoice={invoice} account={account} t={t} />
      )}
      <footer className="iv-pay-foot">
        <span>{t.secured}</span>
        {invoice.issuerEmail && (
          <a href={`mailto:${invoice.issuerEmail}`}>{invoice.issuerEmail}</a>
        )}
      </footer>
    </div>
  );
}

/** A link that does not open. It cannot know the invoice, so it asks in both languages. */
export function InvalidLinkPage() {
  return (
    <div className="iv-pay">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.ember.backdrop} alt="" data-active="true" />
      </div>
      <main className="iv-pay-ticket" data-plain>
        <article className="iv-pay-doc">
          {(['en', 'es'] as const).map((language) => (
            <div key={language} className="iv-pay-gone" lang={language}>
              <h1>{words[language].invalid}</h1>
              <p>{words[language].invalidDetail}</p>
            </div>
          ))}
        </article>
      </main>
    </div>
  );
}

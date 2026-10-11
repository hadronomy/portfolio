import type { CustomerInvoice } from '@portfolio/invoices/customer-access';
import type { Currency, Language } from '@portfolio/invoices/model';
import { useRouter } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
} from 'lucide-react';
import { useId, useState } from 'react';
import { authClient } from '../auth/client';
import { coverArt } from '../invoices/covers';
import { longDate, moneyOf } from '../invoices/pay-words';
import { Button, MorphText } from '../invoices/ui';
import type { AccountPage } from './account.server';
import { CodeSignIn } from './code-sign-in';
import { accountWords } from './words';
import '../invoices/invoices.css';

// The customer's account: a sign-in card until they prove their inbox, then
// every invoice billed to it, the next payment first. Each invoice opens its
// own page, where it is paid as its plan allows. It wears the same paper and backdrop as the
// payment page, since it is the same customer looking at the same invoices.

function SignIn({
  language,
  available,
}: {
  language: Language;
  available: boolean;
}) {
  const t = accountWords[language];
  const router = useRouter();
  return (
    <div className="iv-signin" lang={language}>
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.tide.backdrop} alt="" />
      </div>
      <a href="/" className="iv-signin-back">
        <ArrowLeft size={15} /> {t.back}
      </a>
      <main className="iv-signin-card">
        <span className="iv-rail-mark" aria-hidden>
          h<span>/</span>
        </span>
        <h1>{t.title}</h1>
        <p>{available ? t.intro : t.unavailable}</p>
        {available && (
          <CodeSignIn
            language={language}
            onSignedIn={() => void router.invalidate()}
          />
        )}
      </main>
    </div>
  );
}

/** Where a row leads: the invoice's page to pay it on, or its PDF when payments are off. */
const hrefOf = (invoice: CustomerInvoice, payments: boolean) =>
  payments
    ? `/invoices/account/${invoice.id}`
    : `/invoices/account/pdf/${invoice.id}`;

/** The cover the invoice wears, small; a plain tile for an invoice without one. */
function Thumb({ invoice }: { invoice: CustomerInvoice }) {
  return invoice.cover === 'none' ? (
    <span className="iv-account-thumb" aria-hidden />
  ) : (
    <img
      className="iv-account-thumb"
      src={coverArt[invoice.cover].banner}
      alt=""
    />
  );
}

/** Where an invoice stands, in one line: paid, or its next payment. */
function standing(invoice: CustomerInvoice) {
  const t = accountWords[invoice.language];
  const money = moneyOf(invoice);
  const { next } = invoice;
  if (!next) return { text: t.paid, tone: 'paid' as const };
  const date = longDate(invoice.language, next.date);
  // The total already sits above the status; a payment of all of it only
  // needs its date.
  const text =
    next.amount === invoice.total
      ? (next.late ? t.overdue : t.due)(date)
      : (next.late ? t.nextLate : t.next)(money(next.amount), date);
  return {
    text: next.of > 1 ? `${text} · ${t.part(next.index, next.of)}` : text,
    tone: next.late ? ('late' as const) : undefined,
  };
}

function Row({
  invoice,
  payments,
}: {
  invoice: CustomerInvoice;
  payments: boolean;
}) {
  // Each row speaks its own invoice's language, as its PDF does.
  const t = accountWords[invoice.language];
  const money = moneyOf(invoice);
  const status = standing(invoice);
  // The whole row is the target: on a phone it is the one thing to tap.
  return (
    <li lang={invoice.language}>
      <a
        className="iv-account-row"
        href={hrefOf(invoice, payments)}
        {...(payments
          ? { 'aria-label': t.open(invoice.number) }
          : { download: true, 'aria-label': t.pdf(invoice.number) })}
      >
        <Thumb invoice={invoice} />
        <span className="iv-account-what">
          <strong className="iv-num">{invoice.number}</strong>
          <span>{invoice.title || invoice.issuer}</span>
        </span>
        <span className="iv-account-owed">
          <span className="iv-num">{money(invoice.total)}</span>
          <span data-tone={status.tone}>
            {status.tone === 'paid' && (
              <Check size={13} strokeWidth={2.4} aria-hidden />
            )}
            {status.text}
          </span>
        </span>
        <span className="iv-account-get" aria-hidden>
          {payments ? <ChevronRight size={16} /> : <Download size={16} />}
        </span>
      </a>
    </li>
  );
}

/**
 * The one payment to make next, ahead of the list: the oldest one late,
 * or else the soonest due. It is the reason most customers come here.
 */
function NextUp({ invoices }: { invoices: readonly CustomerInvoice[] }) {
  const invoice = [...invoices]
    .filter((item) => item.next)
    .sort((a, b) => (a.next?.date ?? '').localeCompare(b.next?.date ?? ''))[0];
  if (!invoice?.next) return null;
  const t = accountWords[invoice.language];
  const money = moneyOf(invoice);
  const { next } = invoice;
  const date = longDate(invoice.language, next.date);
  return (
    <a
      className="iv-account-next"
      href={hrefOf(invoice, true)}
      lang={invoice.language}
      data-tone={next.late ? 'late' : undefined}
    >
      <span className="iv-account-next-label">
        {next.late ? t.latePayment : t.nextPayment}
      </span>
      <strong className="iv-num">{money(next.amount)}</strong>
      <span className="iv-account-next-what">
        <span className="iv-num">{invoice.number}</span>
        {' · '}
        {(next.late ? t.overdueOn : t.dueOn)(date)}
        {next.of > 1 && ` · ${t.part(next.index, next.of)}`}
      </span>
      <span className="iv-btn" data-variant="primary" data-size="sm">
        <span>{t.pay}</span>
        <ArrowRight size={14} aria-hidden />
      </span>
    </a>
  );
}

function Group({
  title,
  invoices,
  payments,
}: {
  title: string;
  invoices: readonly CustomerInvoice[];
  payments: boolean;
}) {
  const id = useId();
  if (invoices.length === 0) return null;
  return (
    <section className="iv-account-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="iv-account-list">
        {invoices.map((invoice) => (
          <Row key={invoice.id} invoice={invoice} payments={payments} />
        ))}
      </ul>
    </section>
  );
}

/** What is still owed and how much of it is late, one figure per currency. */
function Totals({
  invoices,
  language,
}: {
  invoices: readonly CustomerInvoice[];
  language: Language;
}) {
  const t = accountWords[language];
  const sums = new Map<Currency, { open: number; late: number }>();
  for (const invoice of invoices) {
    const remaining = Number(invoice.remaining);
    if (remaining <= 0) continue;
    const sum = sums.get(invoice.currency) ?? { open: 0, late: 0 };
    sum.open += remaining;
    // Late is what the plan already asked for, not the whole balance.
    if (invoice.next?.late) sum.late += Number(invoice.next.amount);
    sums.set(invoice.currency, sum);
  }
  const figures = (pick: 'open' | 'late') =>
    [...sums]
      .filter(([, sum]) => sum[pick] > 0)
      .map(([currency, sum]) =>
        moneyOf({ language, currency })(sum[pick].toFixed(2)),
      );
  const open = figures('open');
  const late = figures('late');
  if (open.length === 0)
    return (
      <div className="iv-account-totals">
        <div>
          <span>{t.settled}</span>
          <strong>{t.allPaid}</strong>
        </div>
      </div>
    );
  return (
    <div className="iv-account-totals">
      <div>
        <span>{t.toPay}</span>
        <strong className="iv-num">{open.join(' + ')}</strong>
      </div>
      {late.length > 0 && (
        <div data-tone="late">
          <span>{t.overdueTotal}</span>
          <strong className="iv-num">{late.join(' + ')}</strong>
        </div>
      )}
    </div>
  );
}

function Invoices({
  language,
  email,
  invoices,
  payments,
}: {
  language: Language;
  email: string;
  invoices: readonly CustomerInvoice[];
  payments: boolean;
}) {
  const t = accountWords[language];
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const open = invoices
    .filter((invoice) => invoice.next)
    .sort((a, b) => (a.next?.date ?? '').localeCompare(b.next?.date ?? ''));
  const settled = invoices.filter((invoice) => !invoice.next);
  return (
    <div className="iv-pay iv-account" lang={language}>
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.tide.backdrop} alt="" data-active="true" />
      </div>
      <main className="iv-account-panel">
        <header className="iv-account-head">
          <div>
            <h1>{t.title}</h1>
            <p>{email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await authClient.signOut();
              await router.invalidate();
              setLeaving(false);
            }}
          >
            <MorphText>{t.signOut}</MorphText>
          </Button>
        </header>
        {payments && <NextUp invoices={invoices} />}
        {invoices.length > 0 && (
          <Totals invoices={invoices} language={language} />
        )}
        {invoices.length > 0 ? (
          <>
            <Group title={t.toPayGroup} invoices={open} payments={payments} />
            <Group title={t.paidGroup} invoices={settled} payments={payments} />
          </>
        ) : (
          <p className="iv-account-empty">
            {t.empty(<strong>{email}</strong>)}
          </p>
        )}
      </main>
      <footer className="iv-pay-foot">
        <a href="/" data-home>
          hadronomy.com
        </a>
      </footer>
    </div>
  );
}

export function AccountScreen({ page }: { page: AccountPage }) {
  switch (page._tag) {
    case 'SignedOut':
      return <SignIn language={page.language} available={page.available} />;
    case 'SignedIn':
      return (
        <Invoices
          language={page.language}
          email={page.email}
          invoices={page.invoices}
          payments={page.payments}
        />
      );
    case 'Owner':
      return null;
  }
}

/** An account address that does not open the invoice asked for. */
export function MissingInvoicePage() {
  return (
    <div className="iv-pay">
      <div className="iv-backdrop" aria-hidden>
        <img src={coverArt.tide.backdrop} alt="" data-active="true" />
      </div>
      <main className="iv-pay-ticket" data-plain>
        <article className="iv-pay-doc">
          {(['en', 'es'] as const).map((language) => (
            <div key={language} className="iv-pay-gone" lang={language}>
              <h1>{accountWords[language].missing}</h1>
              <p>{accountWords[language].missingDetail}</p>
            </div>
          ))}
          <a
            className="iv-btn"
            data-variant="secondary"
            href="/invoices/account"
          >
            <ArrowLeft size={14} aria-hidden />
            <span>{accountWords.en.allInvoices}</span>
          </a>
        </article>
      </main>
    </div>
  );
}

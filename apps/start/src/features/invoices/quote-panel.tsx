import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { bills } from '@portfolio/invoices/billing';
import { formatMoney } from '@portfolio/invoices/calculate';
import type { InvoiceData, InvoiceId } from '@portfolio/invoices/model';
import {
  clausesIn,
  hasPages,
  outline,
  type PageNode,
  readPages,
} from '@portfolio/invoices/pages';
import {
  acceptedOn,
  type QuoteResponse,
  signatureSource,
} from '@portfolio/invoices/quote-model';
import { quoteNotices } from '@portfolio/invoices/quote-notices';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FilePen,
  Link2,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Speak, useT } from '../../lib/i18n';
import {
  getQuoteDeliveries,
  getQuoteEmails,
  getQuoteLinks,
  retryEmail,
  revokeQuoteLinks,
  shareQuoteLink,
} from './api';
import { pagesMorph } from './pages-studio';
import { QuoteEmailDialog } from './quote-email';
import { type DocumentStatus, documentStatus } from './status';
import { useToast } from './toast';
import { Button, cn, layer, MorphText, StatusChip } from './ui';
import { useWorkspace } from './workspace';

// The owner's end of a quote, in the inspector: how long it stands, the
// pages the customer will read, the link that sends it, and what came back.
// Each state of the quote shows only the step that can follow it.

const shortDay = (day: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
const moment = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );

const refusals: Record<string, string> = {
  draft: 'Issue the quote before you send it.',
  expired: 'This quote has expired. Revise it to send a new version.',
  answered: 'The customer has already answered this quote.',
};

/**
 * The send button and its menu: email the quote, or make a link to copy
 * once; and close the open ones. Emailing opens the compose dialog, which
 * shows the email as it will go out.
 */
function QuoteLinkMenu({
  id,
  data,
  number,
}: {
  id: InvoiceId;
  data: InvoiceData;
  number: string | null;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const key = ['quote-links', id];
  const links = useQuery({
    queryKey: key,
    queryFn: () => getQuoteLinks({ data: { id } }),
  });
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [made, setMade] = useState<{ url: string; copied: boolean } | null>(
    null,
  );
  const share = useMutation({
    mutationFn: () => shareQuoteLink({ data: { id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast(refusals[result.reason] ?? 'The quote cannot be sent.', 'error');
        setOpen(false);
        return;
      }
      await client.invalidateQueries({ queryKey: key });
      const copied = await navigator.clipboard
        .writeText(result.url)
        .then(() => true)
        .catch(() => false);
      setMade({ url: result.url, copied });
    },
    onError: () => toast('The link could not be created. Try again.', 'error'),
  });
  const revoke = useMutation({
    mutationFn: () => revokeQuoteLinks({ data: { id } }),
    onSuccess: async (closed) => {
      setOpen(false);
      toast(closed === 1 ? 'Link closed.' : `${closed} links closed.`);
      await client.invalidateQueries({ queryKey: key });
    },
    onError: () => toast('The links could not be closed. Try again.', 'error'),
  });
  const count = links.data ?? 0;
  const who = data.customer.name.trim().split(/\s+/)[0] || 'the customer';
  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setMade(null);
        }}
      >
        <Popover.Trigger asChild>
          <Button size="sm" variant={count ? 'secondary' : 'primary'}>
            <Send size={14} />
            <MorphText>
              {count === 0
                ? 'Send for an answer'
                : count === 1
                  ? '1 link open'
                  : `${count} links open`}
            </MorphText>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className={cn(layer, 'iv-menu', 'iv-share')}
          >
            {made ? (
              <>
                <p className="iv-share-title">
                  {made.copied ? 'Link copied' : 'Copy the link'}
                </p>
                <div className="iv-share-link">
                  <input
                    readOnly
                    value={made.url}
                    aria-label="Quote link"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant={made.copied ? 'ghost' : 'primary'}
                    onClick={async () => {
                      await navigator.clipboard.writeText(made.url);
                      setMade({ ...made, copied: true });
                    }}
                  >
                    {made.copied ? <Check size={14} /> : <Copy size={14} />}
                    <MorphText>{made.copied ? 'Copied' : 'Copy'}</MorphText>
                  </Button>
                </div>
                <p className="iv-share-note">
                  It opens until the quote expires. This is the only time it is
                  shown.
                </p>
              </>
            ) : (
              <>
                <p className="iv-share-title">Send {number ?? 'the quote'}</p>
                <div className="iv-share-ways">
                  <button
                    type="button"
                    className="iv-share-way"
                    onClick={() => {
                      setOpen(false);
                      setComposing(true);
                    }}
                  >
                    <Mail size={16} aria-hidden />
                    <span>
                      <strong>Email it to {who}</strong>
                      <small>
                        {data.customer.email ||
                          'With its PDF and a link to sign'}
                      </small>
                    </span>
                    <ChevronRight size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="iv-share-way"
                    disabled={share.isPending}
                    onClick={() => share.mutate()}
                  >
                    <Link2 size={16} aria-hidden />
                    <span>
                      <strong>
                        <MorphText>
                          {share.isPending ? 'Preparing…' : 'Copy a link'}
                        </MorphText>
                      </strong>
                      <small>To send it yourself, any way you like</small>
                    </span>
                    <ChevronRight size={15} aria-hidden />
                  </button>
                </div>
                <p className="iv-share-note">
                  The customer reads the quote, its pages and conditions, then
                  signs it or declines. You both get the confirmation by email.
                </p>
                {count > 0 && (
                  <div className="iv-share-open">
                    <p>
                      {count === 1
                        ? '1 link is open.'
                        : `${count} links are open.`}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate()}
                    >
                      {count === 1 ? 'Close it' : 'Close them'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <QuoteEmailDialog
        id={id}
        data={data}
        number={number}
        open={composing}
        onOpenChange={setComposing}
        onSent={(to, state) => {
          toast(
            translate('en')(
              state === 'sent'
                ? m.mail_invitation_sent
                : state === 'failed'
                  ? m.mail_invitation_failed
                  : m.mail_invitation_queued,
              { to },
            ),
          );
          void client.invalidateQueries({ queryKey: key });
          void client.invalidateQueries({ queryKey: ['quote-emails', id] });
          void client.invalidateQueries({ queryKey: ['quote-deliveries', id] });
        }}
      />
    </>
  );
}

/** Where the quote went by email: the latest send, and how many before it. */
function EmailedLine({ id }: { id: InvoiceId }) {
  const emails = useQuery({
    queryKey: ['quote-emails', id],
    queryFn: () => getQuoteEmails({ data: { id } }),
  });
  const [latest, ...earlier] = emails.data ?? [];
  // A send made just now is marked for a moment; one from before is not.
  const [seen] = useState(() => new Date().toISOString());
  if (!latest) return null;
  return (
    <p
      className="iv-quote-emailed"
      data-fresh={latest.sentAt > seen || undefined}
    >
      <Mail size={13} aria-hidden />
      <span>
        Emailed to <strong>{latest.to}</strong> · {moment(latest.sentAt)}
        {earlier.length > 0 &&
          ` · ${earlier.length === 1 ? 'once' : `${earlier.length} times`} before`}
      </span>
    </p>
  );
}

function DeliveryRows({ id }: { id: InvoiceId }) {
  const t = useT();
  const query = useQueryClient();
  const { refetch: refreshWorkspace } = useWorkspace();
  const deliveries = useQuery({
    queryKey: ['quote-deliveries', id],
    queryFn: () => getQuoteDeliveries({ data: { id } }),
    refetchInterval: (query) =>
      query.state.data?.some((mail) => mail.state === 'pending')
        ? 15_000
        : false,
  });
  const sent =
    deliveries.data
      ?.filter((mail) => mail.state === 'sent')
      .map((mail) => `${mail.id}:${mail.sentAt}`)
      .join(',') ?? '';
  // The Worker can finish delivery while this panel is open.
  useEffect(() => {
    if (!sent) return;
    void query.invalidateQueries({ queryKey: ['quote-emails', id] });
    void refreshWorkspace();
  }, [id, query, refreshWorkspace, sent]);
  const retry = useMutation({
    mutationFn: (email: string) => retryEmail({ data: { id, email } }),
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: ['quote-deliveries', id] });
      void query.invalidateQueries({ queryKey: ['quote-emails', id] });
    },
  });
  const rows = deliveries.data?.filter((mail) => mail.state !== 'sent') ?? [];
  if (!rows.length) return null;
  return (
    <section
      className="iv-mail-deliveries"
      aria-label={t(m.mail_delivery_heading)}
    >
      {rows.map((mail) => (
        <div key={mail.id} className="iv-mail-delivery" data-state={mail.state}>
          <Mail size={14} aria-hidden />
          <div>
            <p>
              <strong>{t(m.mail_delivery_kind, { kind: mail.kind })}</strong>
            </p>
            <p className="iv-mail-delivery-state">
              <MorphText>
                {t(
                  mail.state === 'failed'
                    ? m.mail_delivery_failed
                    : m.mail_delivery_pending,
                )}
              </MorphText>
            </p>
            <p className="iv-mail-delivery-recipient">{mail.recipient}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={retry.isPending}
            onClick={() => retry.mutate(mail.id)}
          >
            <MorphText>
              {t(
                retry.isPending && retry.variables === mail.id
                  ? m.mail_delivery_retrying
                  : m.mail_delivery_retry,
              )}
            </MorphText>
          </Button>
        </div>
      ))}
      {retry.isError && (
        <output className="iv-mail-delivery-error">
          {t(m.mail_delivery_retry_refused)}
        </output>
      )}
    </section>
  );
}

/** Words in a node, counted in each block on its own, as the studio counts them. */
function wordsIn(node: PageNode): number {
  if (node.text !== undefined)
    return node.text.split(/\s+/).filter(Boolean).length;
  return (node.content ?? []).reduce((sum, child) => sum + wordsIn(child), 0);
}

/** The pages as a card: a small sheet, what they hold, and the door to the studio. */
function PagesCard({
  data,
  editable,
  hidden,
  onOpen,
}: {
  data: InvoiceData;
  editable: boolean;
  /** The studio is open: the card has become it. */
  hidden: boolean;
  onOpen: () => void;
}) {
  const pages = data.quote?.pages;
  const written = !!pages && hasPages(pages);
  const headings = pages ? outline(pages) : [];
  const placed = pages ? clausesIn(pages).length : 0;
  const words = pages ? wordsIn(readPages(pages)) : 0;
  const title = headings[0]?.text || (written ? 'Pages' : 'Write the proposal');
  const facts = written
    ? [
        headings.length === 1 ? '1 section' : `${headings.length} sections`,
        placed ? (placed === 1 ? '1 clause' : `${placed} clauses`) : null,
        `${words} words`,
      ].filter(Boolean)
    : ['Scope, timeline and conditions, typeset with the quote.'];
  return (
    <button
      type="button"
      className="iv-pages-card"
      data-empty={!written || undefined}
      onClick={onOpen}
      style={
        { viewTransitionName: hidden ? 'none' : pagesMorph } as CSSProperties
      }
    >
      <span className="iv-pages-thumb" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="iv-pages-what">
        <strong>{title}</strong>
        <small>{facts.join(' · ')}</small>
      </span>
      <span className="iv-pages-go">
        <FilePen size={14} aria-hidden />
        {editable ? (written ? 'Edit' : 'Write') : 'Read'}
      </span>
    </button>
  );
}

/** The customer's answer, and what it rests on. */
function AnswerCard({ response }: { response: QuoteResponse }) {
  const accepted = response.outcome === 'accepted';
  return (
    <div className="iv-answer" data-outcome={response.outcome}>
      <span className="iv-answer-mark" aria-hidden>
        {accepted ? <Check size={14} /> : <X size={14} />}
      </span>
      <div>
        <p className="iv-answer-head">
          {accepted ? 'Accepted' : 'Declined'} by{' '}
          <strong>{response.name}</strong>
        </p>
        <p className="iv-answer-line">
          {moment(response.decidedAt)}
          {response.earlyStart &&
            ' · Asked to start before the withdrawal period ends'}
        </p>
        {response.signature && (
          <img
            className="iv-answer-signature"
            src={signatureSource(response.signature)}
            alt={`Signature of ${response.name}`}
          />
        )}
        <details className="iv-answer-proof">
          <summary>
            Evidence
            <ChevronDown size={13} aria-hidden />
          </summary>
          <dl>
            <div>
              <dt>Link sent to</dt>
              <dd>{response.email}</dd>
            </div>
            <div>
              <dt>Network address</dt>
              <dd className="iv-num">{response.address || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Browser</dt>
              <dd title={response.agent}>{response.agent || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Document read</dt>
              <dd className="iv-num" title={response.digest}>
                SHA-256 {response.digest.slice(0, 16)}…
              </dd>
            </div>
            <div>
              <dt>Confirmation</dt>
              <dd>
                {response.confirmedAt
                  ? `Emailed ${moment(response.confirmedAt)}`
                  : 'Not emailed yet'}
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </div>
  );
}

/**
 * How an accepted quote is being billed: each payment of the plan the
 * customer accepted, and the invoice it went out on. The law asks for an
 * invoice for every payment taken before the work is done, so each row is
 * one invoice, and the next one due is the obvious step.
 */
function Billing({
  data,
  response,
  pending,
  onBill,
}: {
  data: InvoiceData;
  response: QuoteResponse;
  pending: boolean;
  onBill: (payment: number) => void;
}) {
  const { workspace } = useWorkspace();
  if (!response.plan) return null;
  const payments = bills(data, response.plan, acceptedOn(response));
  const today = new Date().toISOString().slice(0, 10);
  const billedAt = new Map(
    response.billed.map((item) => [item.payment, item.invoiceId]),
  );
  const next = payments.findIndex((_, index) => !billedAt.has(index));
  const money = (value: string) => formatMoney(value, 'en', data.currency);
  return (
    <section className="iv-billing" aria-label="Billing">
      <p className="iv-billing-head">
        <span>{response.plan.name || 'Billing'}</span>
        <span>
          {payments.length === 1
            ? 'One invoice'
            : `${payments.length} invoices, one for each payment`}
        </span>
      </p>
      <ol>
        {payments.map((payment, index) => {
          const invoiceId = billedAt.get(index);
          const invoice = invoiceId
            ? workspace?.invoices.find((item) => item.id === invoiceId)
            : undefined;
          const state = invoice
            ? documentStatus(
                invoice,
                workspace?.payments ?? [],
                workspace?.responses ?? {},
              )
            : null;
          const late = !invoice && payment.date < today;
          return (
            <li key={payment.id} data-billed={invoice ? '' : undefined}>
              <span className="iv-billing-step iv-num">{index + 1}</span>
              <span className="iv-billing-what">
                <span>{payment.label || `Payment ${index + 1}`}</span>
                <span data-tone={late ? 'late' : undefined}>
                  {invoice
                    ? `Due ${shortDay(invoice.data.dueDate)}`
                    : late
                      ? `Was due ${shortDay(payment.date)}`
                      : payment.date === today
                        ? 'Due today'
                        : `Due ${shortDay(payment.date)}`}
                </span>
              </span>
              <span className="iv-billing-amount iv-num">
                {money(state ? state.total : payment.amount)}
              </span>
              <span className="iv-billing-action">
                {invoice && state ? (
                  <Link
                    to="/invoices/$invoiceId"
                    params={{ invoiceId: invoice.id }}
                    className="iv-billing-link"
                  >
                    <StatusChip status={state.status} />
                    {invoice.number && (
                      <span className="iv-num">{invoice.number}</span>
                    )}
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant={index === next ? 'primary' : 'ghost'}
                    disabled={pending}
                    onClick={() => onBill(index)}
                  >
                    <span>Draft invoice</span>
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function QuotePanel({
  id,
  data,
  number,
  status,
  issued,
  pending,
  studioOpen,
  onPages,
  onBill,
  onRevise,
}: {
  id: InvoiceId;
  /** The quote as the form holds it now. */
  data: InvoiceData;
  number: string | null;
  status: DocumentStatus;
  issued: boolean;
  pending: boolean;
  studioOpen: boolean;
  onPages: () => void;
  /** Drafts the invoice for one payment of the accepted plan. */
  onBill: (payment: number) => void;
  onRevise: () => void;
}) {
  const { workspace } = useWorkspace();
  const response = workspace?.responses[id] ?? null;
  const until = data.quote?.validUntil ?? data.issueDate;
  const today = new Date().toISOString().slice(0, 10);
  const notices = data.quote
    ? quoteNotices(data, data.quote, data.language)
    : [];
  const left = daysBetween(today, until);
  const validity = !issued
    ? `Valid ${daysBetween(data.issueDate, until)} days from issue, until ${shortDay(until)}`
    : status === 'open'
      ? `Valid until ${shortDay(until)} · ${left === 0 ? 'last day' : left === 1 ? '1 day left' : `${left} days left`}`
      : status === 'expired'
        ? `Expired on ${shortDay(until)}, unanswered`
        : // Once answered, validity no longer matters; the answer says it all.
          null;
  return (
    <div className="iv-quote-panel">
      {validity && (
        <p
          className="iv-quote-validity"
          data-tone={status === 'expired' ? 'late' : undefined}
        >
          {validity}
        </p>
      )}
      <PagesCard
        data={data}
        editable={!issued}
        hidden={studioOpen}
        onOpen={onPages}
      />
      {notices.length > 0 && (
        <p className="iv-quote-notices">
          Also printed: {notices.map((notice) => notice.title).join(' · ')}.
        </p>
      )}
      {response && <AnswerCard response={response} />}
      {response?.outcome === 'accepted' && response.plan && (
        <Billing
          data={data}
          response={response}
          pending={pending}
          onBill={onBill}
        />
      )}
      {!issued ? (
        <p className="iv-muted">Issue the quote to send it for an answer.</p>
      ) : (
        <div className="iv-inline">
          {status === 'open' && (
            <QuoteLinkMenu id={id} data={data} number={number} />
          )}
          {(status === 'open' ||
            status === 'expired' ||
            status === 'declined') && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={onRevise}
            >
              <span>{number ? `Revise ${number}` : 'Revise'}</span>
            </Button>
          )}
        </div>
      )}
      {issued && (
        <>
          <EmailedLine id={id} />
          <Speak locale="en">
            <DeliveryRows id={id} />
          </Speak>
        </>
      )}
    </div>
  );
}

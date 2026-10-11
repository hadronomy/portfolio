import { formatMoney } from '@portfolio/invoices/calculate';
import type { Review } from '@portfolio/invoices/collection-model';
import type { Currency, InvoiceId, Language } from '@portfolio/invoices/model';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { getCollection, revokePaymentLinks, sharePaymentLink } from './api';
import { shareFailureMessage as failureMessage } from './share-words';
import { useToast } from './toast';
import { Button, cn, layer, MorphText } from './ui';

// The owner's end of online payments: a link to send, and one line saying
// where payment stands. How the customer pays is the invoice's payment plan,
// set in its own section; a link only opens the invoice to it. A new link is shown once, then
// only its hash is kept, so the popover is the one place it can be copied.

/** A review as a headline and what it means for the owner. */
function reviewNote(review: Review, money: (amount: string) => string) {
  switch (review._tag) {
    case 'Mismatch':
      return {
        title: 'Stripe totals differ',
        detail:
          'Stripe added this invoice up differently, so it was never opened for payment. Nothing was charged.',
      };
    case 'Overpaid':
      return {
        title: 'Paid more than owed',
        detail:
          'A payment came in above the outstanding balance. Refund the difference in Stripe.',
      };
    case 'Refunded':
      return {
        title: `${money(review.amount)} refunded`,
        detail:
          'That amount is outstanding again, and online payment is off for this invoice.',
      };
    case 'Closed':
      return {
        title: 'Closed in Stripe',
        detail:
          'The invoice was voided or written off in the Stripe dashboard. Online payment is off.',
      };
  }
}

/** The link the owner just made: shown, copied, then gone for good. */
type Made = { readonly url: string; readonly copied: boolean };

/** The collection state both halves of this file read, from one cache entry. */
function useCollection(id: InvoiceId) {
  return useQuery({
    queryKey: ['invoice-collection', id],
    queryFn: () => getCollection({ data: { id } }),
  });
}

/**
 * The payment link button and its menu: make a link, copy it the one time
 * it exists, and close the links already out. The label
 * says what is out at a glance, so the section needs no status line.
 */
export function PaymentLinkMenu({
  id,
  outstanding,
  currency,
  language,
  options,
}: {
  id: InvoiceId;
  /** What is still owed, as a decimal string. */
  outstanding: string;
  currency: Currency;
  language: Language;
  /** How many payment plans the customer chooses between. */
  options: number;
}) {
  const money = (amount: string) => formatMoney(amount, language, currency);
  const toast = useToast();
  const client = useQueryClient();
  const key = ['invoice-collection', id];
  const status = useCollection(id);
  const [open, setOpen] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const share = useMutation({
    mutationFn: () => sharePaymentLink({ data: { id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast(failureMessage(result.failure), 'error');
        setOpen(false);
        await client.invalidateQueries({ queryKey: key });
        return;
      }
      client.setQueryData(key, result.status);
      const copied = await navigator.clipboard
        .writeText(result.url)
        .then(() => true)
        .catch(() => false);
      setMade({ url: result.url, copied });
    },
    onError: () =>
      toast('The payment link could not be created. Try again.', 'error'),
  });
  const revoke = useMutation({
    mutationFn: () => revokePaymentLinks({ data: { id } }),
    onSuccess: async (closed) => {
      setOpen(false);
      toast(
        closed === 1
          ? 'Link closed. It no longer opens.'
          : `${closed} links closed. They no longer open.`,
      );
      await client.invalidateQueries({ queryKey: key });
    },
    onError: () => toast('The links could not be closed. Try again.', 'error'),
  });

  const current = status.data;
  // Paid, in review, or switched off: there is no link to make or manage.
  if (
    !current ||
    current._tag === 'Unconfigured' ||
    current._tag === 'Paid' ||
    current._tag === 'Review' ||
    Number(outstanding) <= 0
  )
    return null;
  const links = current._tag === 'Open' ? current.links : 0;
  const label =
    links === 1
      ? '1 link open'
      : links > 1
        ? `${links} links open`
        : current._tag === 'Preparing'
          ? 'Finish payment link'
          : 'Payment link';

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The last link is never shown again.
        if (!next) setMade(null);
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm">
          <Link2 size={14} />
          <MorphText>{label}</MorphText>
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
                  aria-label="Payment link"
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
                It opens for 30 days. This is the only time it is shown.
              </p>
            </>
          ) : (
            <>
              {links > 0 && (
                <div className="iv-share-open">
                  <p>
                    {links === 1
                      ? '1 link is open.'
                      : `${links} links are open.`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate()}
                  >
                    {links === 1 ? 'Close it' : 'Close them'}
                  </Button>
                </div>
              )}
              <p className="iv-share-title">New payment link</p>
              <p className="iv-share-note">
                {options > 1
                  ? `They choose one of ${options} ways to pay ${money(outstanding)}.`
                  : `They pay ${money(outstanding)} as the payment plan sets out.`}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="iv-share-go"
                disabled={share.isPending}
                onClick={() => share.mutate()}
              >
                <MorphText>
                  {share.isPending ? 'Preparing…' : 'Create link'}
                </MorphText>
              </Button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** What the owner has to settle before online payment can go on, if anything. */
export function PaymentReview({
  id,
  currency,
  language,
}: {
  id: InvoiceId;
  currency: Currency;
  language: Language;
}) {
  const current = useCollection(id).data;
  if (current?._tag !== 'Review') return null;
  const note = reviewNote(current.review, (amount) =>
    formatMoney(amount, language, currency),
  );
  return (
    <div className="iv-callout" aria-live="polite">
      <CircleAlert size={15} aria-hidden />
      <div>
        <strong>{note.title}</strong>
        <p>{note.detail}</p>
      </div>
    </div>
  );
}

import type { Payment } from '@portfolio/invoices/model';
import { Undo2 } from 'lucide-react';
import { IconButton } from './ui';

// The ledger for one invoice, one row per payment: when and how on the left,
// the amount in a right-aligned column, and the one action a row allows at
// the end. The action column keeps its width on every row, so amounts line
// up whether or not a row can be reversed.

const methodNames: Record<Payment['method'], string> = {
  transfer: 'Transfer',
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
  stripe: 'Paid online',
};

/**
 * What a row says beneath its date. A Stripe refund replaces a payment's
 * record with one for what was kept, so the kept row names the refund and
 * the replaced row says why it no longer counts.
 */
function detailOf(
  payment: Payment,
  all: readonly Payment[],
  money: (amount: string) => string,
) {
  if (payment.method !== 'stripe') {
    const method = methodNames[payment.method];
    const said = payment.reference
      ? `${method} · ${payment.reference}`
      : method;
    return payment.reversedAt ? `${said} · Reversed` : said;
  }
  const siblings = all.filter((other) => other.reference === payment.reference);
  const original = Math.max(...siblings.map((other) => Number(other.amount)));
  const kept = siblings.find((other) => !other.reversedAt);
  if (payment.reversedAt)
    return kept
      ? 'Paid online · Replaced after a refund'
      : 'Paid online · Refunded';
  const refunded = original - Number(payment.amount);
  return refunded > 0
    ? `Paid online · ${money(refunded.toFixed(2))} refunded`
    : 'Paid online';
}

export function PaymentList({
  payments,
  money,
  day,
  pending,
  onReverse,
}: {
  payments: readonly Payment[];
  money: (amount: string) => string;
  day: (date: string) => string;
  pending: boolean;
  onReverse: (id: Payment['id']) => void;
}) {
  const reversible = (payment: Payment) =>
    !payment.reversedAt && payment.method !== 'stripe';
  // With nothing to reverse, the action column goes, and the amounts align
  // with the outstanding total above them.
  const actions = payments.some(reversible);
  return (
    <ul className="iv-payments" data-actions={actions || undefined}>
      {payments.map((payment) => (
        <li
          className="iv-payment"
          key={payment.id}
          data-reversed={!!payment.reversedAt}
        >
          <div>
            <span>{day(payment.date)}</span>
            <small>{detailOf(payment, payments, money)}</small>
          </div>
          <strong className="iv-num">{money(payment.amount)}</strong>
          {/* Stripe holds online payments: undoing one is a refund there,
              which comes back to the ledger on its own. */}
          {!actions ? null : reversible(payment) ? (
            <IconButton
              label="Reverse payment"
              disabled={pending}
              onClick={() => onReverse(payment.id)}
            >
              <Undo2 size={15} />
            </IconButton>
          ) : (
            <span aria-hidden />
          )}
        </li>
      ))}
    </ul>
  );
}

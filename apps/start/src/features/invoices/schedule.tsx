import type { CheckoutInvoice } from '@portfolio/invoices/collection-model';
import type { Instalment, Schedule } from '@portfolio/invoices/plan';
import { Check } from 'lucide-react';
import { fromCents, longDate, moneyOf, toCents, type Words } from './pay-words';

// The plan on the customer's stub: one bar, a segment per instalment sized
// by its amount, and a line per instalment under it. The bar also answers
// the form above the button: what the chosen payment will cover is drawn
// ahead of what is already paid, so a customer sees which instalments a
// payment settles before they make it.

/** How much of each instalment `amount` settles, earliest first, as payments are applied. */
export function covers(instalments: readonly Instalment[], amount: string) {
  let left = toCents(amount);
  return instalments.map((part) => {
    const open = toCents(part.amount) - toCents(part.paid);
    const covered = Math.max(0, Math.min(left, open));
    left -= covered;
    return covered;
  });
}

/** The name a customer reads for an instalment: the owner's, or its place. */
export function partName(
  t: Words,
  instalments: readonly Instalment[],
  index: number,
) {
  const part = instalments[index];
  if (part?.label && part.step)
    return `${part.label} ${part.step.index + 1}/${part.step.of}`;
  return part?.label || t.paymentOf(index + 1, instalments.length);
}

export function PlanSchedule({
  schedule,
  invoice,
  pending,
  t,
}: {
  schedule: Schedule;
  invoice: CheckoutInvoice;
  /** The payment the form is about to make, when it reads as one. */
  pending: string | null;
  t: Words;
}) {
  const money = moneyOf(invoice);
  const { instalments } = schedule;
  // One payment of everything, with nothing paid yet, has nothing to show.
  if (instalments.length < 2 && toCents(schedule.paid) === 0) return null;
  const ahead = pending ? covers(instalments, pending) : [];
  return (
    <section className="iv-plan" aria-label={t.plan}>
      <div className="iv-plan-bar" aria-hidden>
        {instalments.map((part, index) => {
          const amount = toCents(part.amount) || 1;
          const paid = toCents(part.paid) / amount;
          const next = (ahead[index] ?? 0) / amount;
          return (
            <span
              key={part.id}
              data-state={part.state}
              style={{ flexGrow: amount }}
            >
              <span data-paid style={{ transform: `scaleX(${paid})` }} />
              <span
                data-pending
                style={{
                  transform: `translateX(${paid * 100}%) scaleX(${next})`,
                }}
              />
            </span>
          );
        })}
      </div>
      {instalments.length > 1 && (
        <ol className="iv-plan-list">
          {instalments.map((part, index) => {
            const paid = toCents(part.paid);
            const open = toCents(part.amount) - paid;
            const note =
              part.state === 'paid'
                ? t.state.paid
                : paid > 0
                  ? t.left(money(fromCents(open)))
                  : t.state[part.state];
            return (
              <li
                key={part.id}
                data-state={part.state}
                data-pending={(ahead[index] ?? 0) > 0 || undefined}
              >
                <span className="iv-plan-mark" aria-hidden>
                  {part.state === 'paid' && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="iv-plan-what">
                  <strong>{partName(t, instalments, index)}</strong>
                  <span>{longDate(invoice.language, part.date)}</span>
                </span>
                <span className="iv-plan-amount">
                  <span className="iv-num">{money(part.amount)}</span>
                  {note && <span>{note}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

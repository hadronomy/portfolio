import {
  type Laid,
  lay,
  maxParts,
  type Part,
  type PaymentPlan,
  type Portion,
  type Terms,
} from '@portfolio/invoices/plan';
import { minimumCharge } from '@portfolio/invoices/stripe/projection';
import { toCents } from './money';
import { once, percent, series } from './plan-starters';

// Edits the studio makes to a plan. Each takes a plan and returns the next
// one, whole, so every change is one value to save and nothing in the
// interface keeps half of a plan.

export const restPart = (plan: PaymentPlan) =>
  plan.parts.find((part) => part.portion._tag === 'Rest');

export function updatePart(
  plan: PaymentPlan,
  id: Part['id'],
  update: (part: Part) => Part,
): PaymentPlan {
  return {
    ...plan,
    parts: plan.parts.map((part) => (part.id === id ? update(part) : part)),
  };
}

/** Turns a single payment into a series of equal ones, or back, keeping its share and start. */
export function reshape(plan: PaymentPlan, id: Part['id']): PaymentPlan {
  return {
    ...plan,
    parts: plan.parts.map((part): Part => {
      if (part.id !== id) return part;
      if (part._tag === 'Once')
        return {
          ...series(part.portion, 3, part.due, undefined, part.label),
          id: part.id,
        };
      return { ...once(part.portion, part.first, part.label), id: part.id };
    }),
  };
}

export const removePart = (plan: PaymentPlan, id: Part['id']): PaymentPlan => ({
  ...plan,
  parts: plan.parts.filter((part) => part.id !== id),
});

/**
 * A new part at the end. It takes a tenth, or the rest when no part does,
 * and falls due a month after the payment before it, so the plan stays in
 * order and still adds up.
 */
export function addPart(plan: PaymentPlan, kind: Part['_tag']): PaymentPlan {
  if (plan.parts.length >= maxParts) return plan;
  const portion: Portion = restPart(plan) ? percent(10) : { _tag: 'Rest' };
  const later = {
    _tag: 'After',
    count: 1,
    unit: 'month',
    from: 'previous',
  } as const;
  return {
    ...plan,
    parts: [
      ...plan.parts,
      kind === 'Once' ? once(portion, later) : series(portion, 3, later),
    ],
  };
}

/**
 * The same amount in another unit: a percentage of the total, a fixed sum,
 * or the rest. A share switched to a number keeps what it came to, so the
 * plan does not move under the owner's hand.
 */
export function convertPortion(
  to: Portion['_tag'],
  cents: number,
  terms: Terms,
): Portion {
  if (to === 'Rest') return { _tag: 'Rest' };
  const total = toCents(terms.total) || 1;
  return to === 'Percent'
    ? percent(Math.max(1, Math.round((cents * 100) / total)))
    : { _tag: 'Amount', value: (Math.max(cents, 0) / 100).toFixed(2) };
}

/** Each part's payments, and what they come to in cents. */
export function partsOf(plan: PaymentPlan, terms: Terms) {
  const laid = lay(plan, terms);
  return plan.parts.map((part) => {
    const payments = laid.filter((payment) => payment.part === part.id);
    return {
      part,
      payments,
      cents: payments.reduce(
        (sum, payment) => sum + toCents(payment.amount),
        0,
      ),
    };
  });
}
export type LaidPart = ReturnType<typeof partsOf>[number];
export type { Laid };

/**
 * How far a part's share can go, in cents. The floor is what Stripe can
 * charge for each of its payments. The ceiling is what the other parts
 * leave, less what a part taking the rest still needs to charge: past it
 * the plan breaks, so sliders and seams stop there.
 */
export function bounds(plan: PaymentPlan, terms: Terms, id: Part['id']) {
  const each = minimumCharge[terms.currency];
  const laid = partsOf(plan, terms);
  const own = laid.find((item) => item.part.id === id);
  const least = each * (own?.payments.length ?? 1);
  const others = laid.reduce(
    (sum, item) =>
      item.part.id === id || item.part.portion._tag === 'Rest'
        ? sum
        : sum + Math.max(item.cents, 0),
    0,
  );
  const rest = laid.find(
    (item) => item.part.portion._tag === 'Rest' && item.part.id !== id,
  );
  const most =
    toCents(terms.total) - others - each * (rest?.payments.length ?? 0);
  return { least, most: Math.max(least, most) };
}

/**
 * Moves the boundary after part `index` to `cents` from the start of the
 * plan. Only the parts either side change, and neither drops below what
 * Stripe can charge for its payments. A part that takes the rest never
 * holds a number: when one side is the rest, the other side alone moves
 * and the rest takes up the difference.
 */
export function moveSeam(
  plan: PaymentPlan,
  terms: Terms,
  index: number,
  cents: number,
): PaymentPlan {
  const laid = partsOf(plan, terms);
  const left = laid[index];
  const right = laid[index + 1];
  if (!left || !right) return plan;
  const start = laid
    .slice(0, index)
    .reduce((sum, item) => sum + Math.max(item.cents, 0), 0);
  const span = Math.max(left.cents, 0) + Math.max(right.cents, 0);
  const each = minimumCharge[terms.currency];
  const total = toCents(terms.total);
  const leftLeast = each * left.payments.length;
  const rightLeast = each * right.payments.length;
  const at = Math.min(
    Math.max(cents, start + leftLeast),
    start + span - rightLeast,
  );
  // A percentage rounds to a whole one, and rounding must not carry a side
  // past what its neighbour still needs: 99.9% of the span is 99%, not 100%.
  const share = (
    item: LaidPart,
    value: number,
    least: number,
    most: number,
  ) => {
    const portion = item.part.portion;
    if (portion._tag === 'Rest') return portion;
    if (portion._tag === 'Amount' || !total)
      return convertPortion(portion._tag, value, terms);
    const percent = Math.min(
      Math.max(
        Math.round((value * 100) / total),
        Math.ceil((least * 100) / total),
      ),
      Math.floor((most * 100) / total),
    );
    return { _tag: 'Percent' as const, value: String(Math.max(percent, 1)) };
  };
  return {
    ...plan,
    parts: plan.parts.map((part, position) => {
      if (position === index && left.part.portion._tag !== 'Rest')
        return {
          ...part,
          portion: share(left, at - start, leftLeast, span - rightLeast),
        };
      if (position === index + 1 && right.part.portion._tag !== 'Rest')
        return {
          ...part,
          portion: share(
            right,
            start + span - at,
            rightLeast,
            span - leftLeast,
          ),
        };
      return part;
    }),
  };
}

/** Whether a seam can move: at least one side must hold a number. */
export const movable = (plan: PaymentPlan, index: number) =>
  plan.parts[index]?.portion._tag !== 'Rest' ||
  plan.parts[index + 1]?.portion._tag !== 'Rest';

/**
 * The step a seam snaps to: a whole percent where the side that moves is a
 * percentage, a whole unit of money where it is an amount.
 */
export function seamStep(plan: PaymentPlan, terms: Terms, index: number) {
  const left = plan.parts[index]?.portion;
  const moving =
    left && left._tag !== 'Rest' ? left : plan.parts[index + 1]?.portion;
  return moving?._tag === 'Amount' ? 100 : toCents(terms.total) / 100;
}

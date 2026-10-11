import type { InvoiceId, Language } from '@portfolio/invoices/model';
import {
  defaultsFor,
  inFull,
  lay,
  type Offer,
  type PaymentPlan,
  problems,
  type Terms,
} from '@portfolio/invoices/plan';
import { CircleAlert, SlidersHorizontal } from 'lucide-react';
import { type CSSProperties, useMemo, useState } from 'react';
import { MiniBar, PlanStudio, studioMorph } from './plan-studio';
import { planLine, planName } from './plan-words';
import { Button, morph } from './ui';
import { useWorkspace } from './workspace';

// How the invoice gets paid, as the inspector shows it: the options the
// customer will choose from, each a name, a line and a bar. The card is
// also the door to the studio: it grows into it, and every bar flies to its
// place in the studio's rail.

/** The plans an invoice offers: its own, or what it would start with. */
export function useOffer(id: InvoiceId, terms: Terms | null, issued: boolean) {
  const { workspace } = useWorkspace();
  const own = workspace?.offers[id];
  const library = workspace?.library;
  const total = terms?.total ?? '0';
  const key = JSON.stringify(library ?? []);
  // Defaults are copies with fresh IDs; making them once per library and
  // total keeps their identity while the owner looks at them. The library
  // is read through `key`: every save hands back a new array of it.
  const fallback = useMemo<Offer>(() => {
    if (issued || !library) return [inFull];
    const defaults = defaultsFor(library, total);
    return defaults.length ? defaults : [inFull];
  }, [key, total, issued]);
  return {
    plans: own?.plans ?? fallback,
    chosen: own?.chosen ?? null,
    own: !!own,
    fallback,
  };
}

/** A few words on how the invoice gets paid, for a closed section. */
export function offerSummary(
  plans: Offer,
  terms: Terms | null,
  language: Language,
) {
  const [only] = plans;
  if (plans.length > 1) return `${plans.length} options`;
  return only && terms ? planName(only, lay(only, terms), language) : '';
}

export function OfferPanel({
  id,
  terms,
  language,
  issued,
  title,
}: {
  id: InvoiceId;
  /** The invoice's total and dates as they stand in the editor, or null with nothing to pay. */
  terms: Terms | null;
  language: Language;
  issued: boolean;
  title: string;
}) {
  const { plans, chosen, own, fallback } = useOffer(id, terms, issued);
  const [open, setOpen] = useState<PaymentPlan['id'] | null | false>(false);
  if (!terms)
    return (
      <p className="iv-muted">Add lines first; a plan splits the total.</p>
    );
  const opened = open !== false;
  const show = (plan: PaymentPlan['id'] | null) => morph(() => setOpen(plan));
  const broken = plans.filter((plan) => problems(plan, terms).length > 0);
  return (
    <>
      <div
        className="iv-offer"
        style={
          { viewTransitionName: opened ? 'none' : studioMorph } as CSSProperties
        }
      >
        <ol className="iv-offer-list">
          {plans.map((plan) => {
            const payments = lay(plan, terms);
            return (
              <li key={plan.id}>
                <button type="button" onClick={() => show(plan.id)}>
                  <span className="iv-offer-name">
                    {planName(plan, payments, language)}
                    {chosen === plan.id && <small>Their choice</small>}
                  </span>
                  <span className="iv-offer-line">
                    {planLine(plan, payments, {
                      language: 'en',
                      currency: terms.currency,
                      today: terms.issueDate,
                    })}
                  </span>
                  <MiniBar
                    payments={payments}
                    {...(opened ? {} : { morph: `plan-${plan.id}` })}
                  />
                </button>
              </li>
            );
          })}
        </ol>
        {broken.length > 0 && (
          <p className="iv-offer-warn">
            <CircleAlert size={14} aria-hidden />
            {broken.length === 1
              ? 'One option does not add up and is not offered.'
              : `${broken.length} options do not add up and are not offered.`}
          </p>
        )}
        <div className="iv-offer-foot">
          <span>
            {own
              ? plans.length > 1
                ? 'The customer picks one when they pay.'
                : 'The customer pays this way.'
              : issued
                ? 'One payment, by the due date.'
                : 'From your defaults.'}
          </span>
          <Button size="sm" onClick={() => show(null)}>
            <SlidersHorizontal size={14} />
            Edit plans
          </Button>
        </div>
      </div>
      {opened && (
        <PlanStudio
          id={id}
          open
          onClose={() => morph(() => setOpen(false))}
          terms={terms}
          language={language}
          issued={issued}
          title={title}
          fallback={fallback}
          initial={open}
        />
      )}
    </>
  );
}

import { m } from '@portfolio/i18n/messages';
import {
  type CheckoutInvoice,
  PayFailure,
  type PlanChoice,
} from '@portfolio/invoices/collection-model';
import type { Choice, Options } from '@portfolio/invoices/plan';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type {
  Appearance,
  Stripe,
  StripeElementsOptions,
} from '@stripe/stripe-js';
// The pure entry waits for the first loadStripe call to fetch Stripe.js, so
// no page but this one ever loads it.
import { loadStripe } from '@stripe/stripe-js/pure';
import { useRouter } from '@tanstack/react-router';
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '../../lib/i18n';
import { type Access, beginPayment } from './api';
import { currencySymbol } from './choices';
import { decimalMark, fromCents, moneyOf, readAmount, toCents } from './money';
import { planLine, planName } from './plan-words';
import { PlanSchedule, partName } from './schedule';
import { Button, MorphText } from './ui';

// The stub's working part: which plan, how much, how, and the one button
// that pays it. When the invoice offers several plans the customer picks
// one first; the plan then decides what may be paid now: set payments to
// pick from, and any amount in a range when it lets them choose. The
// button always says the amount it will take.

// One Stripe.js per publishable key for the life of the tab: Elements must
// keep the same instance, or it tears down what the customer has typed.
// The sandbox assistant is off: it floats over the pay button on a phone,
// and a sandbox page should look like the one customers get with live keys.
const instances = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string) {
  let instance = instances.get(key);
  if (!instance) {
    instance = loadStripe(key, {
      developerTools: { assistant: { enabled: false } },
    });
    instances.set(key, instance);
  }
  return instance;
}

// The Payment Element lives in Stripe's iframe, so it cannot read the page's
// custom properties: these restate the workspace tokens it needs. Inputs
// carry the same self-coloured ring and focus halo as the workspace fields.
// Stripe reads only comma-separated rgba(), never the slash form.
const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#141414',
    colorBackground: '#ffffff',
    colorText: '#141414',
    colorTextSecondary: '#5d5d61',
    colorTextPlaceholder: '#8a8a8f',
    colorDanger: '#b4312a',
    colorIconTab: '#5d5d61',
    colorIconTabSelected: '#141414',
    fontFamily: 'Geist, system-ui, sans-serif',
    fontSizeBase: '14px',
    fontWeightNormal: '400',
    fontWeightMedium: '500',
    borderRadius: '10px',
    spacingUnit: '4px',
    gridRowSpacing: '12px',
    gridColumnSpacing: '10px',
    focusBoxShadow: '0 0 0 1px #141414, 0 0 0 4px rgba(20, 20, 20, 0.08)',
  },
  rules: {
    // A real border, not a ring: Stripe draws its own shadow on inputs, and
    // a border is the one edge it leaves alone.
    '.Input': {
      border: '1px solid rgba(20, 20, 20, 0.14)',
      boxShadow: 'none',
      padding: '11px 12px',
    },
    '.Input:hover': { border: '1px solid rgba(20, 20, 20, 0.24)' },
    '.Input:focus': {
      border: '1px solid #141414',
      boxShadow: '0 0 0 3px rgba(20, 20, 20, 0.08)',
    },
    '.Input--invalid': {
      border: '1px solid #b4312a',
      boxShadow: 'none',
    },
    '.Label': { fontWeight: '500', fontSize: '12px', color: '#5d5d61' },
    '.Tab': {
      border: '1px solid rgba(20, 20, 20, 0.12)',
      boxShadow: 'none',
    },
    '.Tab:hover': { color: '#141414' },
    '.Tab--selected, .Tab--selected:hover, .Tab--selected:focus': {
      border: '1px solid #141414',
      boxShadow: '0 0 0 1px #141414',
      color: '#141414',
    },
    '.Error': { fontSize: '12px' },
  },
};

const today = () => new Date().toISOString().slice(0, 10);

/** What the customer's own attempt is doing, apart from the invoice. */
type Phase =
  | { readonly _tag: 'Ready' }
  | { readonly _tag: 'Paying' }
  | { readonly _tag: 'Failed'; readonly message: string };

/** Why the typed amount cannot be paid, if it cannot. */
type Problem = 'unreadable' | 'small' | 'large' | null;

/** One of the plan's set payments, or an amount the customer types. */
type Pick = number | 'other';

export interface PayStubProps {
  /** How the page reached the invoice; the server checks it again on paying. */
  readonly access: Access;
  readonly invoice: CheckoutInvoice;
  /** Every plan the customer may still pay by. */
  readonly plans: readonly PlanChoice[];
  /** The one they are looking at. */
  readonly plan: PlanChoice;
  /** A payment already landed under `plan`, so it is the only one. */
  readonly locked: boolean;
  readonly onPlan: (plan: PlanChoice['id']) => void;
  readonly publishableKey: string;
  /**
   * Called once Stripe has taken `amount`, or has it on its way. The page
   * then waits for the ledger to show it.
   */
  readonly onPaid: (amount: string, settled: boolean) => void;
}

/**
 * The set payment the form starts on: everything already due when more
 * than one instalment has come due, so a customer who fell behind catches
 * up in one go; otherwise the first the plan offers.
 */
function firstPick(options: Options): number {
  const due = options.choices.findIndex((choice) => choice.kind === 'due');
  return due >= 0 ? due : 0;
}

export function PayStub(props: PayStubProps) {
  const { invoice, publishableKey } = props;
  const first = props.plan.options.choices[firstPick(props.plan.options)];
  // Deferred mode: the form draws before a PaymentIntent exists, so the
  // amount can change under it. The intent is made on submit, for the
  // amount chosen then.
  const options = useMemo<StripeElementsOptions>(
    () => ({
      mode: 'payment',
      amount: toCents(first?.amount ?? invoice.remaining),
      currency: invoice.currency.toLowerCase(),
      appearance,
      locale: invoice.language,
      // Stripe's iframe loads its own fonts; Google serves Geist with the
      // cross-origin headers that requires.
      fonts: [
        {
          cssSrc:
            'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap',
        },
      ],
    }),
    // The options are read once, at mount; later amounts go through
    // elements.update, which keeps what the customer has typed.
    [],
  );
  return (
    <Elements stripe={stripeFor(publishableKey)} options={options}>
      <PayForm {...props} />
    </Elements>
  );
}

function PayForm({
  access,
  invoice,
  plans,
  plan,
  locked,
  onPlan,
  onPaid,
}: PayStubProps) {
  const { schedule, options } = plan;
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const t = useT();
  const money = moneyOf(invoice);
  const name = useId();
  const amountId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>({ _tag: 'Ready' });
  // The button waits for the form it submits: pressing it before Stripe has
  // drawn the fields would only fail.
  const [loaded, setLoaded] = useState(false);
  const [pick, setPick] = useState<Pick>(() => firstPick(options));
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const planGroup = useId();

  // Another plan has its own payments to pick from; start on its first.
  const [shown, setShown] = useState(plan.id);
  if (shown !== plan.id) {
    setShown(plan.id);
    setPick(firstPick(options));
    setTouched(false);
  }

  const { choices, range } = options;
  const typed = readAmount(text);
  const problem: Problem =
    pick !== 'other' || !range
      ? null
      : typed === null
        ? 'unreadable'
        : toCents(typed) < toCents(range.minimum)
          ? 'small'
          : toCents(typed) > toCents(range.maximum)
            ? 'large'
            : null;
  const amount =
    pick === 'other'
      ? problem
        ? null
        : typed
      : (choices[pick]?.amount ?? null);
  const ready = !!stripe && !!elements && loaded && !!amount;
  const busy = phase._tag === 'Paying';
  const offered = choices.length + (range ? 1 : 0);
  const next = schedule.instalments.findIndex((part) => part.state !== 'paid');

  // Elements shows the payment methods that suit the amount: keep it told.
  useEffect(() => {
    if (!elements || !amount) return;
    elements.update({ amount: toCents(amount) });
  }, [elements, amount]);

  // Back from a bank's page: a payment that went through is already on its
  // way to the ledger; one that did not gets a word next to the button.
  useEffect(() => {
    if (!stripe) return;
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('payment_intent_client_secret');
    if (!secret) return;
    window.history.replaceState(null, '', window.location.pathname);
    stripe.retrievePaymentIntent(secret).then(({ paymentIntent }) => {
      if (!paymentIntent) return;
      if (
        paymentIntent.status === 'succeeded' ||
        paymentIntent.status === 'processing'
      )
        onPaid(
          fromCents(paymentIntent.amount),
          paymentIntent.status === 'succeeded',
        );
      else setPhase({ _tag: 'Failed', message: t(m.pay_failed) });
    });
  }, [stripe, onPaid, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!stripe || !elements || !amount || busy) return;
    setPhase({ _tag: 'Paying' });
    const { error: incomplete } = await elements.submit();
    if (incomplete) {
      // The Payment Element marks the field itself; the button only resets.
      setPhase({ _tag: 'Ready' });
      return;
    }
    const started = await beginPayment({
      data: { access, amount, attempt: crypto.randomUUID(), plan: plan.id },
    }).catch(() => null);
    if (!started?.ok) {
      const failure = started?.failure ?? PayFailure.cases.Unreachable.make({});
      PayFailure.match(failure, {
        // The invoice or its plan moved on (paid elsewhere, plan changed,
        // link closed): show what is true now rather than an error about
        // what was.
        Changed: () => {
          setPhase({ _tag: 'Ready' });
          router.invalidate();
        },
        Unreachable: () =>
          setPhase({ _tag: 'Failed', message: t(m.pay_unreachable) }),
      });
      return;
    }
    const result = await stripe.confirmPayment({
      elements,
      clientSecret: started.clientSecret,
      confirmParams: { return_url: window.location.href.split('?')[0] ?? '' },
      redirect: 'if_required',
    });
    if (result.error) {
      // A card or validation error carries a message written for the
      // customer; anything else would only confuse them.
      const own =
        result.error.type === 'card_error' ||
        result.error.type === 'validation_error';
      setPhase({
        _tag: 'Failed',
        message: (own && result.error.message) || t(m.pay_failed),
      });
      return;
    }
    const { status } = result.paymentIntent;
    if (status === 'succeeded' || status === 'processing') {
      setPhase({ _tag: 'Ready' });
      setText('');
      onPaid(amount, status === 'succeeded');
    } else setPhase({ _tag: 'Failed', message: t(m.pay_failed) });
  }

  const hint =
    range &&
    (touched && problem
      ? problem === 'unreadable'
        ? t(m.pay_unreadable)
        : problem === 'small'
          ? t(m.pay_too_small, { from: money(range.minimum) })
          : t(m.pay_too_large, { to: money(range.maximum) })
      : t(m.pay_range, {
          from: money(range.minimum),
          to: money(range.maximum),
        }));

  /** What a set payment is called, and the line under it. */
  const describe = (choice: Choice): [string, string | null] => {
    // The date is already above, in the stub's headline and the plan.
    if (schedule.instalments.length === 1) return [t(m.pay_whole), null];
    if (choice.kind === 'next' && next >= 0)
      return [partName(t, schedule.instalments, next), null];
    return [t(m.pay_choice, { choice: choice.kind }), null];
  };

  return (
    <form className="iv-pay-form" onSubmit={submit} aria-busy={busy} noValidate>
      {plans.length > 1 && (
        <fieldset className="iv-pay-options iv-pay-plans" disabled={busy}>
          <legend>{t(m.pay_how_to_pay)}</legend>
          {plans.map((choice) => {
            const { instalments } = choice.schedule;
            const range = choice.options.range;
            return (
              <label key={choice.id} data-checked={choice.id === plan.id}>
                <input
                  type="radio"
                  name={planGroup}
                  checked={choice.id === plan.id}
                  onChange={() => onPlan(choice.id)}
                />
                <span className="iv-pay-option-what">
                  <strong>
                    {planName(choice.schedule.plan, instalments, t)}
                  </strong>
                  <span>
                    {planLine(choice.schedule.plan, instalments, {
                      t,
                      currency: invoice.currency,
                      today: today(),
                      ...(range ? { floor: range.minimum } : {}),
                    })}
                  </span>
                </span>
                <span className="iv-pay-plan-now">
                  <span className="iv-num">
                    {money(
                      choice.options.choices[firstPick(choice.options)]
                        ?.amount ?? invoice.remaining,
                    )}
                  </span>
                  <small>{t(m.pay_pay_now)}</small>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {locked && (
        <p className="iv-pay-plan-kept">
          {t(m.pay_your_plan, {
            name: planName(plan.schedule.plan, schedule.instalments, t),
          })}
        </p>
      )}
      <PlanSchedule schedule={schedule} invoice={invoice} pending={amount} />
      {offered > 1 && (
        <fieldset className="iv-pay-options" disabled={busy}>
          <legend
            className={plans.length > 1 ? 'iv-pay-amount-legend' : 'iv-sr'}
          >
            {t(plans.length > 1 ? m.pay_how_much_now : m.pay_how_much)}
          </legend>
          {choices.map((choice, index) => {
            const [title, detail] = describe(choice);
            return (
              <label key={choice.kind} data-checked={pick === index}>
                <input
                  type="radio"
                  name={name}
                  checked={pick === index}
                  onChange={() => {
                    setPick(index);
                    setTouched(false);
                  }}
                />
                <span className="iv-pay-option-what">
                  <strong>{title}</strong>
                  {detail && <span>{detail}</span>}
                </span>
                <span className="iv-num">{money(choice.amount)}</span>
              </label>
            );
          })}
          {range && (
            <div className="iv-pay-other" data-checked={pick === 'other'}>
              <label>
                <input
                  type="radio"
                  name={name}
                  checked={pick === 'other'}
                  onChange={() => {
                    setPick('other');
                    setTouched(false);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                />
                <span className="iv-pay-option-what">
                  <strong>{t(m.pay_other)}</strong>
                </span>
              </label>
              <div className="iv-pay-part" data-open={pick === 'other'}>
                <div>
                  <div>
                    <label className="iv-sr" htmlFor={amountId}>
                      {t(m.pay_how_much)}
                    </label>
                    <div
                      className="iv-pay-amount"
                      data-invalid={(touched && !!problem) || undefined}
                    >
                      <span aria-hidden>
                        {currencySymbol(invoice.currency)}
                      </span>
                      <input
                        ref={inputRef}
                        id={amountId}
                        value={text}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={range.minimum.replace(
                          '.',
                          decimalMark(invoice.language),
                        )}
                        disabled={busy || pick !== 'other'}
                        tabIndex={pick === 'other' ? 0 : -1}
                        aria-invalid={(touched && !!problem) || undefined}
                        aria-describedby={hintId}
                        onChange={(event) => setText(event.target.value)}
                        onBlur={() => {
                          setTouched(true);
                          // A readable amount is written back the way the
                          // invoice writes amounts, so what is shown is
                          // what will be paid.
                          if (typed)
                            setText(
                              typed.replace('.', decimalMark(invoice.language)),
                            );
                        }}
                      />
                    </div>
                    <p
                      id={hintId}
                      className="iv-pay-hint"
                      data-tone={touched && problem ? 'error' : undefined}
                    >
                      {hint}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </fieldset>
      )}
      <div className="iv-pay-element" data-loaded={loaded || undefined}>
        <PaymentElement
          options={{
            layout: { type: 'tabs', defaultCollapsed: false },
            readOnly: busy,
            // The invoice already says where the customer is and how to
            // reach them; the form starts from that instead of a guess.
            defaultValues: {
              billingDetails: {
                ...(invoice.customerEmail
                  ? { email: invoice.customerEmail }
                  : {}),
                address: { country: invoice.customerCountry },
              },
            },
          }}
          onReady={() => setLoaded(true)}
          onLoadError={() =>
            setPhase({ _tag: 'Failed', message: t(m.pay_unloaded) })
          }
        />
      </div>
      <p className="iv-pay-error" role="alert">
        {phase._tag === 'Failed' ? phase.message : ''}
      </p>
      <Button
        type="submit"
        variant="primary"
        className="iv-pay-submit"
        disabled={!ready || busy}
      >
        <MorphText>
          {busy
            ? t(m.pay_confirming)
            : t(m.pay_pay, {
                amount: money(
                  amount ?? choices[0]?.amount ?? invoice.remaining,
                ),
              })}
        </MorphText>
      </Button>
    </form>
  );
}

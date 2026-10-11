import { translate } from '@portfolio/i18n';
import { formatMoney } from '@portfolio/invoices/calculate';
import type { InvoiceId, Language } from '@portfolio/invoices/model';
import {
  copyPlan,
  type Laid,
  lay,
  maxParts,
  maxPlans,
  Offer,
  type Part,
  type PaymentPlan,
  PlanLibrary,
  type PlanTemplate,
  type Problem,
  problems,
  type Terms,
} from '@portfolio/invoices/plan';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { Schema } from 'effect';
import {
  ArrowLeft,
  Bookmark,
  CircleAlert,
  Copy,
  GripVertical,
  Plus,
  Repeat,
  Star,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from 'motion/react';
import {
  type CSSProperties,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { currencySymbol } from './choices';
import { fromCents, toCents } from './money';
import { PlanStrip, PlanTimeline } from './plan-chart';
import {
  addPart,
  bounds,
  type LaidPart,
  partsOf,
  removePart,
  reshape,
  restPart,
  updatePart,
} from './plan-edit';
import { starters } from './plan-starters';
import {
  CountEditor,
  DueEditor,
  EveryEditor,
  FloorEditor,
  PortionEditor,
  Toggle,
  Token,
} from './plan-tokens';
import {
  AnchorContext,
  dueText,
  everyText,
  invoiceAnchors,
  planLine,
  planName,
  portionText,
  quoteAnchors,
} from './plan-words';
import { useToast } from './toast';
import { Button, cn, IconButton, layer, MorphText } from './ui';
import { useWorkspace } from './workspace';

// The room where plans are made. The owner sees every option the customer
// will choose from, builds the one in front of them as sentences whose
// words are controls, and watches the calendar the customer gets fill in
// beside it. The library keeps plans for reuse; a starred plan is offered
// on every invoice issued without plans of its own.

const ease = [0.22, 1, 0.36, 1] as const;

/** The view-transition name the studio and the card it opens from share. */
export const studioMorph = 'plan-studio';

/**
 * Saves `value` a moment after the last change, as drafts save. A value
 * equal to what is saved never saves again, and an unreadable one waits for
 * the next change.
 */
function useAutosave<T>(
  value: T,
  saved: T,
  readable: (value: T) => boolean,
  save: (value: T) => Promise<boolean>,
) {
  const [state, setState] = useState<'saved' | 'saving'>('saved');
  const toast = useToast();
  const wanted = JSON.stringify(value);
  const current = useRef(value);
  current.current = value;
  const writer = useRef(save);
  writer.current = save;
  useEffect(() => {
    if (wanted === JSON.stringify(saved) || !readable(current.current)) return;
    setState('saving');
    const timer = window.setTimeout(async () => {
      const ok = await writer.current(current.current).catch(() => false);
      setState('saved');
      if (!ok) toast('The plans could not be saved.', 'error');
    }, 450);
    return () => window.clearTimeout(timer);
  }, [wanted, saved, readable, toast]);
  return state;
}

const isOffer = Schema.is(Offer);
const isLibrary = Schema.is(PlanLibrary);

function problemText(
  problem: Problem,
  parts: readonly LaidPart[],
  currency: Terms['currency'],
) {
  const money = (amount: string) => formatMoney(amount, 'en', currency);
  const nameOf = (id: Part['id']) => {
    const index = parts.findIndex((item) => item.part.id === id);
    return parts[index]?.part.label || `Payment ${index + 1}`;
  };
  switch (problem._tag) {
    case 'Overrun':
      return 'The payments before the rest already cover the total, so the rest comes to nothing.';
    case 'Unbalanced':
      return problem.difference.startsWith('-')
        ? `The payments ask for ${money(problem.difference.slice(1))} more than the total.`
        : `The payments leave ${money(problem.difference)} unpaid.`;
    case 'TwoRests':
      return 'Only one payment can take the rest.';
    case 'TooSmall':
      return `${nameOf(problem.part)} has a payment under what Stripe can charge.`;
    case 'OutOfOrder':
      return `${nameOf(problem.part)} falls before the payment ahead of it.`;
    case 'TooMany':
      return 'A plan can ask for 36 payments at most.';
    case 'FloorTooHigh':
      return 'The least payment is more than the whole invoice.';
  }
}

export interface StudioProps {
  id: InvoiceId;
  open: boolean;
  onClose: () => void;
  terms: Terms;
  language: Language;
  /** An issued invoice: changes reach a customer who may be paying already. */
  issued: boolean;
  /** The invoice as the header names it: "INV-2026-0003 · Estudio Norte". */
  title: string;
  /** The plans the invoice offers before it has its own: the defaults. */
  fallback: Offer;
  /** The option to open on. */
  initial: PaymentPlan['id'] | null;
  /** A quote's plans count from acceptance to delivery, an invoice's from issue to its due date. */
  kind: 'invoice' | 'quote';
}

export function PlanStudio(props: StudioProps) {
  const { open, onClose } = props;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          className={cn(layer, 'iv-studio')}
          aria-describedby={undefined}
          style={{ viewTransitionName: studioMorph } as CSSProperties}
        >
          <AnchorContext.Provider
            value={props.kind === 'quote' ? quoteAnchors : invoiceAnchors}
          >
            <Studio {...props} />
          </AnchorContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Studio({
  id,
  onClose,
  terms,
  language,
  issued,
  title,
  fallback,
  initial,
}: StudioProps) {
  const { workspace, mutate } = useWorkspace();
  const own = workspace?.offers[id];
  const savedOffer = own?.plans ?? fallback;
  const [offer, setOffer] = useState<Offer>(savedOffer);
  const [library, setLibrary] = useState<PlanLibrary>(
    () => workspace?.library ?? [],
  );
  const [selected, setSelected] = useState(initial ?? offer[0]?.id);
  const [hot, setHot] = useState<Part['id'] | null>(null);
  const chosen = own?.chosen ?? null;

  const offerState = useAutosave(offer, savedOffer, isOffer, async (plans) => {
    const result = await mutate({ action: 'offer', id, plans });
    return result.ok;
  });
  const libraryState = useAutosave(
    library,
    workspace?.library ?? [],
    isLibrary,
    async (next) => (await mutate({ action: 'library', library: next })).ok,
  );

  const plan = offer.find((item) => item.id === selected) ?? offer[0];
  if (!plan) return null;
  const setPlan = (next: PaymentPlan) =>
    setOffer((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  const addOption = (next: PaymentPlan) => {
    if (offer.length >= maxPlans) return;
    setOffer([...offer, next]);
    setSelected(next.id);
  };
  const removeOption = (gone: PaymentPlan) => {
    const rest = offer.filter((item) => item.id !== gone.id);
    if (!rest.length) return;
    setOffer(rest);
    if (selected === gone.id) setSelected(rest[0]?.id);
  };
  const template = library.find(
    (item) => item.plan.name.trim() === plan.name.trim() && plan.name.trim(),
  );
  const keep = () =>
    setLibrary((current) =>
      template
        ? current.map((item) =>
            item === template ? { ...item, plan: copyPlan(plan) } : item,
          )
        : [...current, { plan: copyPlan(plan), default: false, from: null }],
    );

  const saving = offerState === 'saving' || libraryState === 'saving';

  return (
    <>
      <header className="iv-studio-head">
        <Dialog.Close asChild>
          <button type="button" className="iv-studio-back">
            <ArrowLeft size={16} aria-hidden />
            <span>Invoice</span>
          </button>
        </Dialog.Close>
        <div className="iv-studio-title">
          <Dialog.Title>Payment plans</Dialog.Title>
          <p>
            {title} ·{' '}
            <span className="iv-num">
              {formatMoney(terms.total, 'en', terms.currency)}
            </span>
          </p>
        </div>
        <output
          className="iv-studio-saved"
          data-saving={saving || undefined}
          aria-live="polite"
        >
          <i aria-hidden />
          <MorphText>{saving ? 'Saving' : 'Saved'}</MorphText>
        </output>
      </header>
      <div className="iv-studio-body">
        <nav className="iv-studio-rail" aria-label="Options and library">
          <Options
            offer={offer}
            selected={plan.id}
            chosen={chosen}
            terms={terms}
            language={language}
            onSelect={setSelected}
            onReorder={setOffer}
          />
          <AddOption
            disabled={offer.length >= maxPlans}
            language={language}
            library={library}
            terms={terms}
            onAdd={addOption}
          />
          {own && (
            <button
              type="button"
              className="iv-studio-reset"
              onClick={async () => {
                const result = await mutate({
                  action: 'offer',
                  id,
                  plans: null,
                });
                if (!result.ok) return;
                // The editor starts over from what the invoice offers now.
                const back = result.workspace.offers[id]?.plans ?? fallback;
                setOffer(back);
                setSelected(back[0]?.id);
              }}
            >
              <span>
                {issued ? 'Back to one payment' : 'Back to your defaults'}
              </span>
            </button>
          )}
          <Library
            library={library}
            terms={terms}
            language={language}
            full={offer.length >= maxPlans}
            onChange={setLibrary}
            onAdd={(item) => addOption(copyPlan(item.plan))}
          />
        </nav>
        <main className="iv-studio-composer">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={plan.id}
              className="iv-composer"
              initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={{ duration: 0.22, ease }}
            >
              <Composer
                plan={plan}
                terms={terms}
                language={language}
                hot={hot}
                onHot={setHot}
                onChange={setPlan}
              />
            </motion.div>
          </AnimatePresence>
          <div className="iv-studio-bar" role="toolbar" aria-label="Option">
            <Button
              size="sm"
              variant="ghost"
              aria-label={template ? 'Update in library' : 'Save to library'}
              onClick={keep}
            >
              <Bookmark size={14} />
              <span className="iv-studio-bar-word">
                <MorphText>
                  {template ? 'Update in library' : 'Save to library'}
                </MorphText>
              </span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Duplicate"
              disabled={offer.length >= maxPlans}
              onClick={() => addOption({ ...copyPlan(plan), name: '' })}
            >
              <Copy size={14} />
              <span className="iv-studio-bar-word">Duplicate</span>
            </Button>
            {issued && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={
                  chosen === plan.id ? 'Their choice' : 'Make it their choice'
                }
                disabled={chosen === plan.id}
                onClick={() => mutate({ action: 'choose', id, plan: plan.id })}
              >
                <UserCheck size={14} />
                <span className="iv-studio-bar-word">
                  <MorphText>
                    {chosen === plan.id
                      ? 'Their choice'
                      : 'Make it their choice'}
                  </MorphText>
                </span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label="Remove"
              disabled={offer.length < 2}
              onClick={() => removeOption(plan)}
            >
              <Trash2 size={14} />
              <span className="iv-studio-bar-word">Remove</span>
            </Button>
            <span className="iv-studio-bar-rule" aria-hidden />
            <Button
              size="sm"
              variant="primary"
              className="iv-studio-done"
              onClick={onClose}
            >
              <MorphText>
                {offer.length === 1 ? 'Done' : `Done · ${offer.length} options`}
              </MorphText>
            </Button>
          </div>
        </main>
        <aside
          className="iv-studio-preview"
          aria-label="What the customer sees"
        >
          <Preview
            plan={plan}
            terms={terms}
            language={language}
            hot={hot}
            onHot={setHot}
          />
        </aside>
      </div>
    </>
  );
}

/** A plan to scale in one thin line: a segment per payment. */
export function MiniBar({
  payments,
  morph,
}: {
  payments: readonly Laid[];
  /** Names the bar for a view transition, so it flies to its place. */
  morph?: string;
}) {
  const order = [...new Set(payments.map((payment) => payment.part))];
  return (
    <span
      className="iv-minibar"
      aria-hidden
      style={
        morph ? ({ viewTransitionName: morph } as CSSProperties) : undefined
      }
    >
      {payments.map((payment) => (
        <i
          key={payment.id}
          data-index={order.indexOf(payment.part) % 6}
          style={{ flexGrow: Math.max(toCents(payment.amount), 1) }}
        />
      ))}
    </span>
  );
}

function Options({
  offer,
  selected,
  chosen,
  terms,
  language,
  onSelect,
  onReorder,
}: {
  offer: Offer;
  selected: PaymentPlan['id'];
  chosen: string | null;
  terms: Terms;
  language: Language;
  onSelect: (id: PaymentPlan['id']) => void;
  onReorder: (offer: Offer) => void;
}) {
  return (
    <section className="iv-rail-group">
      <h3>The customer chooses</h3>
      <Reorder.Group
        as="ol"
        axis="y"
        className="iv-choices"
        values={[...offer]}
        onReorder={(next) => onReorder(next)}
      >
        {offer.map((item, index) => {
          const payments = lay(item, terms);
          const broken = problems(item, terms).length > 0;
          return (
            <Reorder.Item
              key={item.id}
              value={item}
              className="iv-choice"
              data-selected={item.id === selected || undefined}
              transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
            >
              <button
                type="button"
                aria-current={item.id === selected || undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className="iv-choice-name">
                  {planName(item, payments, translate(language))}
                  {broken && (
                    <CircleAlert
                      size={13}
                      aria-label="Not offered until fixed"
                    />
                  )}
                </span>
                <span className="iv-choice-line">
                  {planLine(item, payments, {
                    t: translate('en'),
                    currency: terms.currency,
                    today: terms.issueDate,
                  })}
                </span>
                <MiniBar payments={payments} morph={`plan-${item.id}`} />
                <span className="iv-choice-tags">
                  {index === 0 && offer.length > 1 && (
                    <small>Opens first</small>
                  )}
                  {chosen === item.id && (
                    <small data-tone="chosen">Their choice</small>
                  )}
                </span>
              </button>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </section>
  );
}

function AddOption({
  disabled,
  language,
  library,
  terms,
  onAdd,
}: {
  disabled: boolean;
  language: Language;
  library: PlanLibrary;
  terms: Terms;
  onAdd: (plan: PaymentPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (plan: PaymentPlan) => {
    onAdd(plan);
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="iv-add-option" disabled={disabled}>
          <Plus size={14} aria-hidden />
          <span>{disabled ? 'Four options at most' : 'Add an option'}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(layer, 'iv-menu', 'iv-add-menu')}
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={16}
        >
          <p className="iv-menu-heading">Start from</p>
          {starters.map((starter) => {
            const plan = starter.make(language);
            return (
              <button
                key={starter.key}
                type="button"
                className="iv-menu-item"
                onClick={() => pick(starter.make(language))}
              >
                <span className="iv-add-what">
                  <span>{starter.title}</span>
                  <small>
                    {planLine(plan, lay(plan, terms), {
                      t: translate('en'),
                      currency: terms.currency,
                      today: terms.issueDate,
                    })}
                  </small>
                </span>
              </button>
            );
          })}
          {library.length > 0 && (
            <>
              <p className="iv-menu-heading">From your library</p>
              {library.map((item) => (
                <button
                  key={item.plan.id}
                  type="button"
                  className="iv-menu-item"
                  onClick={() => pick(copyPlan(item.plan))}
                >
                  <span className="iv-add-what">
                    <span>
                      {planName(
                        item.plan,
                        lay(item.plan, terms),
                        translate(language),
                      )}
                    </span>
                    <small>
                      {planLine(item.plan, lay(item.plan, terms), {
                        t: translate('en'),
                        currency: terms.currency,
                        today: terms.issueDate,
                      })}
                    </small>
                  </span>
                </button>
              ))}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Library({
  library,
  terms,
  language,
  full,
  onChange,
  onAdd,
}: {
  library: PlanLibrary;
  terms: Terms;
  language: Language;
  /** The invoice offers all it can; templates cannot be added. */
  full: boolean;
  onChange: (library: PlanLibrary) => void;
  onAdd: (template: PlanTemplate) => void;
}) {
  const update = (template: PlanTemplate, change: Partial<PlanTemplate>) =>
    onChange(
      library.map((item) =>
        item === template ? { ...item, ...change } : item,
      ),
    );
  return (
    <section className="iv-rail-group">
      <h3>Library</h3>
      {library.length === 0 ? (
        <p className="iv-rail-empty">
          Save an option here to use it again. Star it to offer it on every new
          invoice.
        </p>
      ) : (
        <Reorder.Group
          as="ul"
          axis="y"
          className="iv-library"
          values={[...library]}
          onReorder={(next) => onChange(next)}
        >
          {library.map((item) => {
            const payments = lay(item.plan, terms);
            return (
              <Reorder.Item
                key={item.plan.id}
                value={item}
                className="iv-template"
                transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
              >
                <button
                  type="button"
                  className="iv-template-use"
                  disabled={full}
                  onClick={() => onAdd(item)}
                  title={
                    full
                      ? 'The invoice offers four options already'
                      : 'Add to this invoice'
                  }
                >
                  <span>
                    {planName(item.plan, payments, translate(language))}
                  </span>
                  <MiniBar payments={payments} />
                </button>
                <button
                  type="button"
                  className="iv-template-star"
                  aria-pressed={item.default}
                  aria-label={
                    item.default
                      ? 'Offered on new invoices'
                      : 'Offer on new invoices'
                  }
                  onClick={() => update(item, { default: !item.default })}
                >
                  <Star size={14} aria-hidden />
                </button>
                {item.default && (
                  <Threshold
                    from={item.from}
                    currency={terms.currency}
                    onChange={(from) => update(item, { from })}
                  />
                )}
                <IconButton
                  label="Remove from library"
                  className="iv-template-remove"
                  onClick={() =>
                    onChange(library.filter((other) => other !== item))
                  }
                >
                  <X size={13} />
                </IconButton>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </section>
  );
}

/** The least total a default applies to, or any. */
function Threshold({
  from,
  currency,
  onChange,
}: {
  from: string | null;
  currency: Terms['currency'];
  onChange: (from: string | null) => void;
}) {
  const [text, setText] = useState(from ?? '');
  const symbol = currencySymbol(currency);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="iv-template-from">
          {from ? `from ${formatMoney(from, 'en', currency)}` : 'any total'}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(layer, 'iv-menu', 'iv-token-pop')}
          side="right"
          align="center"
          sideOffset={8}
          collisionPadding={16}
        >
          <div className="iv-token-editor">
            <p className="iv-token-note">
              Offered on invoices that total at least:
            </p>
            <label className="iv-big-number">
              <span className="iv-sr">Least total</span>
              <span aria-hidden>{symbol}</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="Any total"
                value={text}
                onChange={(event) => {
                  const next = event.target.value.replace(',', '.');
                  setText(event.target.value);
                  if (next === '') onChange(null);
                  else if (
                    /^\d{1,9}(\.\d{0,2})?$/.test(next) &&
                    Number(next) > 0
                  )
                    onChange(String(Number(next)));
                }}
              />
            </label>
            <p className="iv-token-note">
              Leave it empty to offer it on every invoice.
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Composer({
  plan,
  terms,
  language,
  hot,
  onHot,
  onChange,
}: {
  plan: PaymentPlan;
  terms: Terms;
  language: Language;
  hot: Part['id'] | null;
  onHot: (part: Part['id'] | null) => void;
  onChange: (plan: PaymentPlan) => void;
}) {
  const parts = partsOf(plan, terms);
  const found = problems(plan, terms);
  const payments = lay(plan, terms);
  const total = toCents(terms.total);
  const named = parts.reduce(
    (sum, item) =>
      item.part.portion._tag === 'Rest' ? sum : sum + Math.max(item.cents, 0),
    0,
  );
  const rest = restPart(plan);
  const year = terms.issueDate.slice(0, 4);
  const money = (cents: number) =>
    formatMoney(fromCents(Math.max(cents, 0)), 'en', terms.currency);
  const flagged = (tag: Problem['_tag'], part: Part['id']) =>
    found.some(
      (problem) =>
        problem._tag === tag && 'part' in problem && problem.part === part,
    );
  const balance = found.find((problem) => problem._tag === 'Unbalanced');

  return (
    <>
      <input
        className="iv-composer-name"
        value={plan.name}
        maxLength={40}
        placeholder={planName(
          { ...plan, name: '' },
          payments,
          translate(language),
        )}
        aria-label="Option name, as the customer reads it"
        onChange={(event) => onChange({ ...plan, name: event.target.value })}
      />
      <PlanStrip
        plan={plan}
        terms={terms}
        parts={parts}
        hot={hot}
        onHot={onHot}
        onChange={onChange}
      />
      <Reorder.Group
        as="ol"
        axis="y"
        className="iv-parts"
        values={plan.parts.map((part) => part.id)}
        onReorder={(order) =>
          onChange({
            ...plan,
            parts: order.flatMap((id) => plan.parts.filter((p) => p.id === id)),
          })
        }
      >
        <AnimatePresence initial={false}>
          {parts.map((item, index) => (
            <Sentence
              key={item.part.id}
              item={item}
              index={index}
              plan={plan}
              terms={terms}
              year={year}
              previous={
                parts[index - 1]?.payments.at(-1)?.date ?? terms.issueDate
              }
              rest={total - named}
              restTaken={!!rest && rest.id !== item.part.id}
              hot={hot === item.part.id}
              invalid={{
                portion:
                  flagged('TooSmall', item.part.id) ||
                  flagged('Overrun', item.part.id),
                due: flagged('OutOfOrder', item.part.id),
              }}
              onHot={onHot}
              onChange={onChange}
              money={money}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="iv-composer-add">
        <button
          type="button"
          disabled={plan.parts.length >= maxParts}
          onClick={() => onChange(addPart(plan, 'Once'))}
        >
          <Plus size={14} aria-hidden />
          <span>Then a payment</span>
        </button>
        <button
          type="button"
          disabled={plan.parts.length >= maxParts}
          onClick={() => onChange(addPart(plan, 'Series'))}
        >
          <Repeat size={14} aria-hidden />
          <span>Then a series</span>
        </button>
      </div>
      <p className="iv-sentence iv-sentence-rules">
        They{' '}
        <Toggle
          on={plan.ahead}
          words={['can', 'can’t']}
          title="Paying ahead of the plan"
          onChange={(ahead) => onChange({ ...plan, ahead })}
        />{' '}
        pay ahead of the plan, and pay{' '}
        <Token
          tone="rule"
          label={
            plan.floor
              ? `any amount from ${portionText(plan.floor, terms.currency)}`
              : 'whole payments only'
          }
          title="What they may pay each time"
          invalid={found.some((problem) => problem._tag === 'FloorTooHigh')}
        >
          <FloorEditor
            floor={plan.floor}
            terms={terms}
            onChange={(floor) => onChange({ ...plan, floor })}
          />
        </Token>
        .
      </p>
      <AnimatePresence initial={false}>
        {found.length > 0 && (
          <motion.div
            className="iv-callout"
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease }}
          >
            <CircleAlert size={15} aria-hidden />
            <div>
              <strong>
                The customer won’t see this option until it adds up
              </strong>
              {found.map((problem) => (
                <p key={JSON.stringify(problem)}>
                  {problemText(problem, parts, terms.currency)}
                </p>
              ))}
              {balance && !rest && plan.parts.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const last = plan.parts.at(-1);
                    if (last)
                      onChange(
                        updatePart(plan, last.id, (part) => ({
                          ...part,
                          portion: { _tag: 'Rest' },
                        })),
                      );
                  }}
                >
                  Let the last payment take the rest
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Sentence({
  item,
  index,
  plan,
  terms,
  year,
  previous,
  rest,
  restTaken,
  hot,
  invalid,
  onHot,
  onChange,
  money,
}: {
  item: LaidPart;
  index: number;
  plan: PaymentPlan;
  terms: Terms;
  year: string;
  previous: string;
  /** What the rest comes to, in cents. */
  rest: number;
  restTaken: boolean;
  hot: boolean;
  invalid: { portion: boolean; due: boolean };
  onHot: (part: Part['id'] | null) => void;
  onChange: (plan: PaymentPlan) => void;
  money: (cents: number) => string;
}) {
  const anchors = useContext(AnchorContext);
  const controls = useDragControls();
  const { part, payments, cents } = item;
  const first = index === 0;
  const name = part.label || `Payment ${index + 1}`;
  const update = (change: (part: Part) => Part) =>
    onChange(updatePart(plan, part.id, change));
  const each = payments[0] ? toCents(payments[0].amount) : 0;
  const { least, most } = bounds(plan, terms, part.id);

  const portion = (
    <Token
      tone="money"
      label={portionText(part.portion, terms.currency)}
      title={`${name}: how much`}
      invalid={invalid.portion}
    >
      <PortionEditor
        portion={part.portion}
        cents={cents}
        rest={rest}
        restTaken={restTaken}
        least={least}
        most={most}
        terms={terms}
        name={name}
        onChange={(next) => update((p) => ({ ...p, portion: next }))}
      />
    </Token>
  );

  return (
    <Reorder.Item
      as="li"
      value={part.id}
      className="iv-part"
      data-index={index % 6}
      data-hot={hot || undefined}
      dragListener={false}
      dragControls={controls}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15, ease } }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
      onPointerEnter={() => onHot(part.id)}
      onPointerLeave={() => onHot(null)}
    >
      <button
        type="button"
        className="iv-part-grip"
        aria-label={`Move ${name}`}
        onPointerDown={(event) => controls.start(event)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const to = index + (event.key === 'ArrowUp' ? -1 : 1);
          if (to < 0 || to >= plan.parts.length) return;
          const parts = [...plan.parts];
          const [moved] = parts.splice(index, 1);
          if (moved) parts.splice(to, 0, moved);
          onChange({ ...plan, parts });
        }}
      >
        <span className="iv-part-swatch" aria-hidden />
        <GripVertical size={14} aria-hidden />
      </button>
      <div className="iv-part-head">
        <input
          className="iv-part-label"
          value={part.label}
          maxLength={60}
          placeholder={`Payment ${index + 1}`}
          aria-label={`Name of payment ${index + 1}, as the customer reads it`}
          onChange={(event) =>
            update((p) => ({ ...p, label: event.target.value }))
          }
        />
        <span className="iv-part-sum iv-num">
          <MorphText>
            {part._tag === 'Series'
              ? `${part.count} × ${money(each)}`
              : money(cents)}
          </MorphText>
        </span>
        <IconButton
          label={
            part._tag === 'Once' ? 'Split into a series' : 'Make it one payment'
          }
          onClick={() => onChange(reshape(plan, part.id))}
        >
          <Repeat size={14} />
        </IconButton>
        <IconButton
          label={`Remove ${name}`}
          disabled={plan.parts.length < 2}
          onClick={() => onChange(removePart(plan, part.id))}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
      <p className="iv-sentence">
        {first ? 'They pay ' : 'Then '}
        {portion}{' '}
        {part._tag === 'Once' ? (
          <Token
            tone="time"
            label={dueText(part.due, { first, series: false }, year, anchors)}
            title={`${name}: when`}
            invalid={invalid.due}
          >
            <DueEditor
              due={part.due}
              terms={terms}
              previous={previous}
              first={first}
              onChange={(due) =>
                update((p) => (p._tag === 'Once' ? { ...p, due } : p))
              }
            />
          </Token>
        ) : (
          <>
            in{' '}
            <Token
              tone="count"
              label={`${part.count} payments`}
              title={`${name}: how many payments`}
            >
              <CountEditor
                count={part.count}
                each={Math.round(cents / part.count)}
                currency={terms.currency}
                onChange={(count) =>
                  update((p) => (p._tag === 'Series' ? { ...p, count } : p))
                }
              />
            </Token>{' '}
            <Token
              tone="count"
              label={everyText(part.every)}
              title={`${name}: how often`}
            >
              <EveryEditor
                every={part.every}
                onChange={(every) =>
                  update((p) => (p._tag === 'Series' ? { ...p, every } : p))
                }
              />
            </Token>
            , starting{' '}
            <Token
              tone="time"
              label={dueText(
                part.first,
                { first, series: true },
                year,
                anchors,
              )}
              title={`${name}: when the first payment falls due`}
              invalid={invalid.due}
            >
              <DueEditor
                due={part.first}
                terms={terms}
                previous={previous}
                first={first}
                onChange={(due) =>
                  update((p) =>
                    p._tag === 'Series' ? { ...p, first: due } : p,
                  )
                }
              />
            </Token>
          </>
        )}
        .
      </p>
      <p className="iv-part-when iv-num">
        <MorphText>
          {payments.length > 1
            ? `${paymentDate(payments[0], year)} → ${paymentDate(payments.at(-1), year)}`
            : paymentDate(payments[0], year)}
        </MorphText>
      </p>
    </Reorder.Item>
  );
}

const paymentDate = (payment: Laid | undefined, year: string) =>
  payment
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        ...(payment.date.slice(0, 4) !== year ? { year: 'numeric' } : {}),
        timeZone: 'UTC',
      }).format(new Date(`${payment.date}T12:00:00Z`))
    : '';

function Preview({
  plan,
  terms,
  language,
  hot,
  onHot,
}: {
  plan: PaymentPlan;
  terms: Terms;
  language: Language;
  hot: Part['id'] | null;
  onHot: (part: Part['id'] | null) => void;
}) {
  const payments = lay(plan, terms);
  const parts = partsOf(plan, terms);
  const floor = plan.floor
    ? plan.floor._tag === 'Percent'
      ? fromCents(
          Math.round((toCents(terms.total) * Number(plan.floor.value)) / 100),
        )
      : plan.floor.value
    : undefined;
  return (
    <>
      <div className="iv-preview-head">
        <h3>
          {problems(plan, terms).length
            ? 'What they would see, once it adds up'
            : 'What they see'}
        </h3>
        <p lang={language}>
          <strong>{planName(plan, payments, translate(language))}</strong>
          <span>
            {planLine(plan, payments, {
              t: translate(language),
              currency: terms.currency,
              today: terms.issueDate,
              ...(floor ? { floor } : {}),
            })}
          </span>
        </p>
      </div>
      <PlanTimeline
        terms={terms}
        payments={payments}
        parts={parts}
        hot={hot}
        onHot={onHot}
      />
      <p className="iv-preview-note">
        {plan.ahead
          ? 'They can pay everything left at any time.'
          : 'They pay what is due, never ahead of it.'}{' '}
        Payments always settle the earliest one first.
      </p>
    </>
  );
}

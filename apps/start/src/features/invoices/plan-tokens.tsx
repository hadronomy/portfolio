import { formatMoney } from '@portfolio/invoices/calculate';
import {
  type Due,
  dueDate,
  type Portion,
  type Share,
  type Span,
  type Terms,
  type Unit,
} from '@portfolio/invoices/plan';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Minus, Plus } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { currencySymbol } from '~/features/invoices/choices';
import { fromCents, toCents } from '~/features/invoices/money';
import { convertPortion } from '~/features/invoices/plan-edit';
import { AnchorContext, shortDate } from '~/features/invoices/plan-words';
import { cn, layer, MorphText, Segmented } from '~/features/invoices/ui';

// The words of a plan sentence that can change. Each is a token tinted by
// what it holds (money, time, a count, a rule) and opens, right where it
// sits, the one control that suits it: a number and a slider for a share,
// a list of dates for when, a stepper for how many. Values morph in place,
// so the sentence never jumps while the owner tries things.

export type Tone = 'money' | 'time' | 'count' | 'rule';

export function Token({
  tone,
  label,
  title,
  invalid,
  children,
}: {
  tone: Tone;
  /** What the sentence reads. */
  label: string;
  /** What a screen reader hears for the control: "Deposit share, 30%". */
  title: string;
  invalid?: boolean;
  /** The editor. Rendered only while open. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="iv-token"
          data-tone={invalid ? 'invalid' : tone}
          aria-label={title}
        >
          <MorphText>{label}</MorphText>
          <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(layer, 'iv-menu', 'iv-token-pop')}
          data-tone={tone}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            // Straight into the number when there is one to type.
            const field = (
              event.currentTarget as HTMLElement
            ).querySelector<HTMLInputElement>('input[data-autofocus]');
            if (!field) return;
            event.preventDefault();
            field.focus();
            field.select();
          }}
        >
          <p className="iv-token-title">{title}</p>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A token that flips between two words on a click, with no editor to open. */
export function Toggle({
  on,
  words,
  title,
  onChange,
}: {
  on: boolean;
  words: readonly [string, string];
  title: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={title}
      className="iv-token"
      data-tone="rule"
      onClick={() => onChange(!on)}
    >
      <MorphText>{on ? words[0] : words[1]}</MorphText>
    </button>
  );
}

/**
 * A slider drawn as the share it sets. The track is the whole scale, `from`
 * to `to`, to match the strip, and what the plan cannot take is shaded past
 * `high`. The thumb rides inside the end of the fill, so the two never
 * part. A drag past an end gives a few pixels and springs back on release
 * instead of stopping dead. Arrows step, Shift steps by ten, Home and End
 * jump to what is allowed.
 */
function Range({
  label,
  value,
  from,
  to,
  low,
  high,
  step,
  ends,
  valueText,
  onChange,
}: {
  label: string;
  value: number;
  /** The ends of the drawn scale. */
  from: number;
  to: number;
  /** The ends of what may be chosen, inside the scale. */
  low: number;
  high: number;
  step: number;
  /** The words under each end of the track. */
  ends: readonly [string, string];
  valueText: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const [dragging, setDragging] = useState(false);
  // Pixels dragged past an end, already damped: the further, the less it gives.
  const [give, setGive] = useState(0);
  const span = to - from || 1;
  const at = (units: number) => ((units - from) * 100) / span;
  const top = Math.max(low, high);
  const settle = (units: number) =>
    Math.min(Math.max(Math.round(units / step) * step, low), top);

  const follow = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box?.width) return;
    const raw = from + ((clientX - box.left) / box.width) * span;
    const past =
      raw > top
        ? ((raw - top) / span) * box.width
        : raw < low
          ? ((raw - low) / span) * box.width
          : 0;
    setGive(Math.sign(past) * Math.min(8, Math.sqrt(Math.abs(past)) * 1.4));
    const next = settle(raw);
    if (next !== value) onChange(next);
  };
  const release = () => {
    setDragging(false);
    setGive(0);
  };
  const nudge = (event: KeyboardEvent<HTMLSpanElement>) => {
    const by =
      {
        ArrowLeft: -step,
        ArrowDown: -step,
        ArrowRight: step,
        ArrowUp: step,
        PageDown: -step * 10,
        PageUp: step * 10,
      }[event.key] ?? 0;
    const next =
      event.key === 'Home'
        ? low
        : event.key === 'End'
          ? top
          : by
            ? settle(value + by * (event.shiftKey ? 10 : 1))
            : null;
    if (next === null) return;
    event.preventDefault();
    if (next !== value) onChange(next);
  };

  return (
    <div
      className="iv-range"
      data-dragging={dragging || undefined}
      style={
        {
          '--at': `${at(Math.min(Math.max(value, from), to))}%`,
          '--high': `${at(top)}%`,
          '--low': `${at(low)}%`,
          '--give': `${give}px`,
        } as CSSProperties
      }
    >
      <div
        ref={track}
        className="iv-range-track"
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          thumb.current?.focus();
          setDragging(true);
          follow(event.clientX);
        }}
        onPointerMove={(event) => dragging && follow(event.clientX)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        {top < to && <span className="iv-range-shut" />}
        <span className="iv-range-fill" />
        <span
          ref={thumb}
          role="slider"
          tabIndex={0}
          className="iv-range-thumb"
          aria-label={label}
          aria-valuemin={low}
          aria-valuemax={top}
          aria-valuenow={value}
          aria-valuetext={valueText(value)}
          onKeyDown={nudge}
        />
      </div>
      <div className="iv-range-ends iv-num" aria-hidden>
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

/**
 * A number typed in large, kept as the owner types it: "12." is not a
 * number yet, so only readable values reach the plan, and leaving the
 * field writes back what the plan holds.
 */
function BigNumber({
  label,
  value,
  unit,
  after,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  invalid?: boolean;
  /** Whether the unit reads after the number: 30 %, but € 500. */
  after: boolean;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);
  return (
    <label
      className="iv-big-number"
      data-after={after || undefined}
      data-invalid={invalid || undefined}
    >
      <span className="iv-sr">{label}</span>
      <span aria-hidden>{unit}</span>
      <input
        data-autofocus
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          const next = event.target.value.replace(',', '.');
          setText(event.target.value);
          if (/^\d{1,9}(\.\d{0,2})?$/.test(next) && Number(next) > 0)
            onChange(String(Number(next)));
        }}
      />
    </label>
  );
}

/** Whole steps up and down, with the number between them. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  children,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset className="iv-stepper" aria-label={label}>
      <button
        type="button"
        aria-label="Fewer"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={15} />
      </button>
      <output className="iv-num">
        <MorphText>{String(value)}</MorphText>
        {children}
      </output>
      <button
        type="button"
        aria-label="More"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={15} />
      </button>
    </fieldset>
  );
}

/** A list of choices, each with what it comes to on its right: a date, an amount. */
function Choices<T>({
  label,
  items,
  isSelected,
  onPick,
}: {
  label: string;
  items: readonly { key: string; value: T; text: string; aside?: string }[];
  isSelected: (value: T) => boolean;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset className="iv-token-list" aria-label={label}>
      {items.map((item) => {
        const selected = isSelected(item.value);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            className="iv-menu-item"
            onClick={() => onPick(item.value)}
          >
            <span>{item.text}</span>
            {item.aside && <small className="iv-num">{item.aside}</small>}
            {selected && <Check size={14} className="iv-token-check" />}
          </button>
        );
      })}
    </fieldset>
  );
}

export function PortionEditor({
  portion,
  cents,
  rest,
  restTaken,
  least,
  most,
  terms,
  name,
  onChange,
}: {
  portion: Portion;
  /** What the part comes to now, in cents. */
  cents: number;
  /** What the rest would come to if this part took it. */
  rest: number;
  /** Another part already takes the rest, or the rest makes no sense here. */
  restTaken: boolean | 'never';
  /** What the part may come to, in cents: from `least` to `most`. */
  least: number;
  most: number;
  terms: Terms;
  name: string;
  onChange: (portion: Portion) => void;
}) {
  const total = toCents(terms.total);
  const money = (value: number) =>
    formatMoney(fromCents(Math.max(value, 0)), 'en', terms.currency);
  const symbol = currencySymbol(terms.currency);
  const kinds: readonly (readonly [Portion['_tag'], string])[] = [
    ['Percent', '%'],
    ['Amount', symbol],
    ...(restTaken === 'never' ? [] : [['Rest', 'The rest'] as const]),
  ];
  const percentOf = (value: number) => (total ? (value * 100) / total : 0);
  const over = cents > most;
  return (
    <div className="iv-token-editor">
      <Segmented
        label={`How ${name} is set`}
        value={portion._tag}
        options={kinds}
        disabled={restTaken === true ? ['Rest'] : []}
        onChange={(kind) => onChange(convertPortion(kind, cents, terms))}
      />
      {portion._tag === 'Rest' ? (
        <p className="iv-token-note">
          Whatever the other payments leave:{' '}
          <strong className="iv-num">
            <MorphText>{money(rest)}</MorphText>
          </strong>
          . It follows the total when the invoice changes.
        </p>
      ) : (
        <>
          <BigNumber
            label={`${name} share`}
            value={portion.value}
            unit={portion._tag === 'Percent' ? '%' : symbol}
            after={portion._tag === 'Percent'}
            invalid={over}
            onChange={(value) => onChange({ ...portion, value })}
          />
          {portion._tag === 'Percent' ? (
            <Range
              label={`${name} share, in percent`}
              value={Number(portion.value)}
              from={0}
              to={100}
              low={Math.min(100, Math.ceil(percentOf(least)))}
              high={Math.floor(percentOf(most))}
              step={1}
              ends={[
                '0%',
                percentOf(most) < 100
                  ? `Up to ${Math.floor(percentOf(most))}%`
                  : '100%',
              ]}
              valueText={(value) =>
                `${value}%, ${money((total * value) / 100)}`
              }
              onChange={(value) =>
                onChange({ _tag: 'Percent', value: String(value) })
              }
            />
          ) : (
            <Range
              label={`${name} amount`}
              value={Math.round(toCents(portion.value) / 100)}
              from={0}
              to={Math.max(Math.floor(total / 100), 1)}
              low={Math.ceil(least / 100)}
              high={Math.floor(most / 100)}
              step={1}
              ends={[
                money(0),
                most < total ? `Up to ${money(most)}` : money(total),
              ]}
              valueText={(value) => money(value * 100)}
              onChange={(value) =>
                onChange({ _tag: 'Amount', value: String(value) })
              }
            />
          )}
          <p className="iv-token-note" data-invalid={over || undefined}>
            {over ? (
              <>
                More than the other payments leave. It can be{' '}
                <strong className="iv-num">{money(most)}</strong> at most.
              </>
            ) : (
              <>
                {portion._tag === 'Percent' ? 'Comes to ' : 'That is '}
                <strong className="iv-num">
                  <MorphText>
                    {portion._tag === 'Percent'
                      ? money(cents)
                      : `${Math.round(percentOf(cents))}% of the total`}
                  </MorphText>
                </strong>
                {portion._tag === 'Amount'
                  ? '. A fixed amount stays put when the total changes.'
                  : '.'}
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

const unitOptions: readonly (readonly [Unit, string])[] = [
  ['day', 'Days'],
  ['week', 'Weeks'],
  ['month', 'Months'],
];

export function DueEditor({
  due,
  terms,
  previous,
  first,
  onChange,
}: {
  due: Due;
  terms: Terms;
  /** The date of the payment before this one, or the issue date for the first. */
  previous: string;
  first: boolean;
  onChange: (due: Due) => void;
}) {
  const anchors = useContext(AnchorContext);
  const year = terms.issueDate.slice(0, 4);
  const date = (value: Due) => shortDate(dueDate(value, terms, previous), year);
  const after = (
    count: number,
    unit: Unit,
    from: 'issue' | 'previous',
  ): Extract<Due, { _tag: 'After' }> => ({ _tag: 'After', count, unit, from });
  const presets: { key: string; value: Due; text: string }[] = [
    { key: 'issue', value: { _tag: 'OnIssue' }, text: anchors.presetIssue },
    { key: 'due', value: { _tag: 'InvoiceDue' }, text: anchors.presetDue },
    ...(first
      ? []
      : [
          {
            key: 'week-later',
            value: after(1, 'week', 'previous'),
            text: '1 week after the last',
          },
          {
            key: 'month-later',
            value: after(1, 'month', 'previous'),
            text: '1 month after the last',
          },
        ]),
    ...[7, 14, 30, 60].map((days) => ({
      key: `${days}`,
      value: after(days, 'day', 'issue'),
      text: `${days} days ${anchors.afterIssue}`,
    })),
  ];
  const same = (a: Due, b: Due) => JSON.stringify(a) === JSON.stringify(b);
  const preset = presets.some((item) => same(item.value, due));
  const custom = due._tag === 'After' ? due : after(45, 'day', 'issue');
  const dateId = useId();
  return (
    <div className="iv-token-editor" data-wide>
      <Choices
        label="When it falls due"
        items={presets.map((item) => ({ ...item, aside: date(item.value) }))}
        isSelected={(value) => same(value, due)}
        onPick={onChange}
      />
      <div
        className="iv-token-custom"
        data-active={(due._tag === 'After' && !preset) || undefined}
      >
        <Stepper
          label="How long after"
          value={custom.count}
          min={0}
          max={3650}
          onChange={(count) => onChange({ ...custom, count })}
        />
        <Segmented
          label="Unit"
          value={custom.unit}
          options={unitOptions}
          onChange={(unit) => onChange({ ...custom, unit })}
        />
        {!first && (
          <Segmented
            label="After what"
            value={custom.from}
            options={[
              ['issue', 'After issue'],
              ['previous', 'After the last'],
            ]}
            onChange={(from) => onChange({ ...custom, from })}
          />
        )}
      </div>
      <label
        className="iv-token-date"
        htmlFor={dateId}
        data-active={due._tag === 'OnDate' || undefined}
      >
        <span>On a date</span>
        <input
          id={dateId}
          type="date"
          value={due._tag === 'OnDate' ? due.date : ''}
          onChange={(event) =>
            event.target.value &&
            onChange({ _tag: 'OnDate', date: event.target.value })
          }
        />
      </label>
    </div>
  );
}

export function CountEditor({
  count,
  each,
  currency,
  onChange,
}: {
  count: number;
  /** What each payment comes to, in cents. */
  each: number;
  currency: Terms['currency'];
  onChange: (count: number) => void;
}) {
  return (
    <div className="iv-token-editor">
      <Stepper
        label="Number of payments"
        value={count}
        min={2}
        max={36}
        onChange={onChange}
      >
        <span className="iv-stepper-unit">payments</span>
      </Stepper>
      <Range
        label="Number of payments"
        value={count}
        from={2}
        to={36}
        low={2}
        high={36}
        step={1}
        ends={['2', '36']}
        valueText={(value) => `${value} payments`}
        onChange={onChange}
      />
      <p className="iv-token-note">
        <strong className="iv-num">
          <MorphText>{`${count} × ${formatMoney(fromCents(Math.max(each, 0)), 'en', currency)}`}</MorphText>
        </strong>
        , the odd cents on the last.
      </p>
    </div>
  );
}

export function EveryEditor({
  every,
  onChange,
}: {
  every: Span;
  onChange: (every: Span) => void;
}) {
  const presets: { key: string; value: Span; text: string }[] = [
    { key: 'week', value: { count: 1, unit: 'week' }, text: 'Every week' },
    {
      key: 'fortnight',
      value: { count: 2, unit: 'week' },
      text: 'Every 2 weeks',
    },
    { key: 'month', value: { count: 1, unit: 'month' }, text: 'Every month' },
    {
      key: 'two-months',
      value: { count: 2, unit: 'month' },
      text: 'Every 2 months',
    },
    {
      key: 'quarter',
      value: { count: 3, unit: 'month' },
      text: 'Every 3 months',
    },
  ];
  return (
    <div className="iv-token-editor" data-wide>
      <Choices
        label="How often"
        items={presets}
        isSelected={(value) =>
          value.count === every.count && value.unit === every.unit
        }
        onPick={onChange}
      />
      <div className="iv-token-custom" data-active>
        <span className="iv-token-custom-label">Every</span>
        <Stepper
          label="How many"
          value={every.count}
          min={1}
          max={120}
          onChange={(count) => onChange({ ...every, count })}
        />
        <Segmented
          label="Unit"
          value={every.unit}
          options={unitOptions}
          onChange={(unit) => onChange({ ...every, unit })}
        />
      </div>
      <p className="iv-token-note">
        Months keep the day of the first payment, or end on a shorter month’s
        last day.
      </p>
    </div>
  );
}

export function FloorEditor({
  floor,
  terms,
  onChange,
}: {
  floor: Share | null;
  terms: Terms;
  onChange: (floor: Share | null) => void;
}) {
  const total = toCents(terms.total);
  const least = floor
    ? floor._tag === 'Percent'
      ? Math.round((total * Number(floor.value)) / 100)
      : toCents(floor.value)
    : 0;
  return (
    <div className="iv-token-editor">
      <Segmented
        label="What they may pay"
        value={floor ? 'part' : 'whole'}
        options={[
          ['whole', 'Whole payments'],
          ['part', 'Any amount'],
        ]}
        onChange={(kind) =>
          onChange(kind === 'whole' ? null : { _tag: 'Percent', value: '10' })
        }
      />
      {floor ? (
        <PortionEditor
          portion={floor}
          cents={least}
          rest={0}
          restTaken="never"
          least={0}
          most={total}
          terms={terms}
          name="The least payment"
          onChange={(portion) => portion._tag !== 'Rest' && onChange(portion)}
        />
      ) : (
        <p className="iv-token-note">
          Each payment is paid as the plan sets it. Paying ahead still covers
          several at once.
        </p>
      )}
    </div>
  );
}

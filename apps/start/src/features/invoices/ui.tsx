import * as Dialog from '@radix-ui/react-dialog';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { AppHotkey } from '@tanstack/react-hotkeys';
import { Check, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { motion } from 'motion/react';
import {
  type ButtonHTMLAttributes,
  Children,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { TextMorph as TorphText } from 'torph/react';
import type { DocumentStatus } from '~/features/invoices/status';
import { useHotkeyLabel, useHotkeyProps } from '~/lib/hotkeys';

// Minimal local cn: clsx + tailwind-merge live in @portfolio/ui, which the
// start app does not depend on, so join here instead of adding a new dep.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Runs `update` as a view transition where the browser has them and the
 * reader has not asked for less motion: the old and new screens morph
 * into each other instead of cutting.
 */
export function morph(update: () => void) {
  if (
    typeof document.startViewTransition !== 'function' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}

// Portalled layers (menus, dialogs, tooltips) render at body level, outside
// .iv-app. Every one of them carries this class so the design tokens and the
// scoped resets reach it.
export const layer = 'iv-layer';

/**
 * Animated readout for text that changes in place: totals, counts, status,
 * validation messages, page numbers. Native input values and printed
 * document text stay plain elements.
 */
export function MorphText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const props = className === undefined ? {} : { className };
  // Duration is milliseconds (Web Animations API).
  return (
    <TorphText {...props} respectReducedMotion duration={220}>
      {children}
    </TorphText>
  );
}

/**
 * Wraps each run of bare text in a span. Text set straight inside a flex
 * control lands in an anonymous box that no selector reaches, and the
 * label trim in invoices.css needs an element to act on.
 */
export function labelled(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let run = '';
  const flush = () => {
    if (run.trim()) out.push(<span key={`text-${out.length}`}>{run}</span>);
    run = '';
  };
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') {
      run += child;
    } else {
      flush();
      out.push(child);
    }
  }
  flush();
  return out;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn('iv-btn', className)}
      data-variant={variant}
      data-size={size}
    >
      {labelled(children)}
    </button>
  );
}

/** One tooltip provider for the workspace: the first tip waits, its neighbours open at once. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={500} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tip({
  label,
  side = 'bottom',
  hotkey,
  children,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** The action's shortcut, written out in the tooltip. */
  hotkey?: AppHotkey;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(layer, 'iv-tip')}
        >
          {label}
          {hotkey && <TipKeys hotkey={hotkey} />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function TipKeys({ hotkey }: { hotkey: AppHotkey }) {
  const label = useHotkeyLabel(hotkey);
  return label && <kbd className="iv-kbd">{label}</kbd>;
}

/**
 * A square icon button. The label doubles as its tooltip and accessible
 * name; its shortcut, if any, shows in the tooltip and beside the button
 * while ⌘ is held.
 */
export function IconButton({
  label,
  side,
  hotkey,
  variant = 'ghost',
  className,
  children,
  ref,
  ...props
}: Omit<ButtonProps, 'aria-label' | 'size'> & {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  hotkey?: AppHotkey;
  ref?: Ref<HTMLButtonElement>;
}) {
  const keys = useHotkeyProps(...(hotkey ? [hotkey] : []));
  return (
    <Tip
      label={label}
      {...(side ? { side } : {})}
      {...(hotkey ? { hotkey } : {})}
    >
      <button
        {...props}
        ref={ref}
        type={props.type ?? 'button'}
        aria-label={label}
        {...keys}
        className={cn('iv-icon-btn', className)}
        data-variant={variant}
      >
        {children}
      </button>
    </Tip>
  );
}

/** Attributes a specialised field can hand to the underlying input. */
type InputExtras = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'autoComplete'
  | 'autoCapitalize'
  | 'spellCheck'
  | 'maxLength'
  | 'inputMode'
  | 'onPaste'
  | 'onFocus'
  | 'onMouseDown'
  | 'role'
  | 'aria-expanded'
  | 'aria-controls'
  | 'aria-activedescendant'
>;

/**
 * The ghost after the caret. A suggestion is only offered while it still
 * continues what was typed, so it can never contradict the owner.
 */
function ghostOf(value: string, suggest: string | undefined) {
  if (!suggest || suggest.length <= value.length) return null;
  return suggest.toLowerCase().startsWith(value.toLowerCase()) ? suggest : null;
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  /** Below the field. Keep it for actions; errors have their own slot. */
  hint?: ReactNode;
  error?: string;
  className?: string;
  name?: string;
  required?: boolean;
  /** Decimal entry: numeric keyboard, right-aligned tabular figures. */
  numeric?: boolean;
  autoFocus?: boolean;
  /** Content inside the field, before and after the text. */
  start?: ReactNode;
  end?: ReactNode;
  /** A checked value: `valid` tints the ring quietly, `invalid` marks it. */
  tone?: 'valid' | 'invalid';
  /**
   * A likely value, drawn as a ghost after the caret while the field has
   * focus. Tab takes it and moves on, → takes it and stays, Esc drops it.
   * Pass it, even as undefined, for the field's whole life: the input keeps
   * one structure, so a suggestion arriving never costs it focus.
   */
  suggest?: string | undefined;
  /** What the value becomes, drawn after it at all times; not accepted. */
  preview?: string | undefined;
  /** Read to assistive tech with the field, never shown. */
  describe?: string | undefined;
  /** The visible box, for anchoring a list to it. */
  boxRef?: Ref<HTMLDivElement>;
  /**
   * Change it to play the settle animation, for a value the form filled in
   * on the owner's behalf: the new text eases in from grey, so the eye
   * finds what changed.
   */
  settle?: number;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  input?: InputExtras;
};

export function Field(props: FieldProps) {
  const {
    label,
    value,
    onChange,
    type = 'text',
    disabled = false,
    placeholder,
    multiline = false,
    hint,
    error,
    className,
    name,
    required = false,
    numeric = false,
    autoFocus = false,
    start,
    end,
    tone,
    suggest,
    preview,
    describe,
    boxRef,
    settle,
    onBlur,
    onKeyDown,
    input,
  } = props;
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const noteId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const offered = disabled ? null : ghostOf(value, suggest);
  const ghost = offered && offered !== dropped ? offered : null;
  const note = [describe, ghost && `Suggestion: ${ghost}. Press Tab to use it.`]
    .filter(Boolean)
    .join(' ');
  const describedBy =
    [
      hint && !error ? hintId : null,
      error ? errorId : null,
      note ? noteId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const invalid = !!error || tone === 'invalid';
  const ghosted = 'suggest' in props || 'preview' in props;

  // The taken text settles from ghost grey to ink rather than jumping.
  function playSettle() {
    const root = rootRef.current;
    if (!root) return;
    delete root.dataset.accepted;
    void root.offsetWidth;
    root.dataset.accepted = '';
  }

  useEffect(() => {
    if (settle) playSettle();
  }, [settle]);

  function accept(next: string) {
    onChange(next);
    playSettle();
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (ghost) {
      const target = event.currentTarget;
      // Email inputs report no caret at all; there → still takes the ghost.
      const atEnd =
        target.selectionStart === null ||
        (target.selectionStart === value.length &&
          target.selectionEnd === value.length);
      if (event.key === 'Tab' && !event.shiftKey) accept(ghost);
      else if (event.key === 'ArrowRight' && atEnd) {
        event.preventDefault();
        accept(ghost);
      } else if (event.key === 'Escape') {
        // Handled here: the Esc must not also close what the field sits in.
        event.preventDefault();
        setDropped(ghost);
      }
    }
    onKeyDown?.(event);
  }

  const shared = {
    id,
    value,
    disabled,
    placeholder,
    name,
    required,
    autoFocus,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
    onBlur,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  const boxed = !multiline && (start || end || ghosted);
  const field = multiline ? (
    <textarea {...shared} className="iv-input" rows={2} />
  ) : (
    <input
      {...shared}
      {...input}
      onKeyDown={keys}
      type={type}
      className={boxed ? 'iv-affix-input' : 'iv-input'}
      {...(ghosted ? { 'aria-autocomplete': 'inline' as const } : {})}
      {...(ghost ? { 'data-ghost': true } : {})}
      {...(numeric
        ? { inputMode: 'decimal' as const, 'data-numeric': true }
        : {})}
      onAnimationEnd={() => {
        if (rootRef.current) delete rootRef.current.dataset.accepted;
      }}
    />
  );
  // The ghost repeats the typed text invisibly so its own text starts
  // exactly where the caret is, in the same font and at the same size.
  const trail = ghost ? ghost.slice(value.length) : value ? preview : null;
  return (
    <div
      ref={rootRef}
      className={cn('iv-field', className)}
      data-invalid={invalid}
      data-tone={tone}
    >
      <label htmlFor={id}>{label}</label>
      {boxed ? (
        // The wrapper is the visible box; clicking its padding or an
        // adornment still lands in the input.
        // biome-ignore lint/a11y/noStaticElementInteractions: focus forwarding only; the input is the control.
        // biome-ignore lint/a11y/useKeyWithClickEvents: the input itself takes the keyboard.
        <div
          ref={boxRef}
          className="iv-input iv-affix"
          data-disabled={disabled || undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget)
              event.currentTarget.querySelector('input')?.focus();
          }}
        >
          {start && <span className="iv-affix-start">{start}</span>}
          <span className="iv-ghost-host">
            {field}
            {trail && (
              <span
                className="iv-ghost"
                data-kind={ghost ? 'suggest' : 'preview'}
                aria-hidden
              >
                <span className="iv-ghost-typed">{value}</span>
                {trail}
              </span>
            )}
          </span>
          {ghost && (
            <button
              type="button"
              tabIndex={-1}
              className="iv-ghost-key"
              aria-label={`Use ${ghost}`}
              // Keeps focus in the input, where the suggestion lives.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => accept(ghost)}
            >
              Tab
            </button>
          )}
          {end && <span className="iv-affix-end">{end}</span>}
        </div>
      ) : (
        field
      )}
      {note && (
        <span id={noteId} className="iv-sr">
          {note}
        </span>
      )}
      {hint && !error && (
        <div id={hintId} className="iv-hint">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="iv-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Extra detail for a select option: a description and a leading icon. */
export type OptionExtra = { hint?: string; icon?: ReactNode };
export type Option<T extends string> = readonly [T, string, OptionExtra?];

/**
 * A select that opens around its own value: the menu is placed so the chosen
 * option sits exactly over the field, and unfolds from that row, so opening
 * it reads as the field expanding rather than a new panel appearing. Options
 * with hints get a header and a footer that describes whichever option is
 * highlighted.
 */
export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
  hideLabel = false,
  context,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
  disabled?: boolean;
  className?: string;
  hideLabel?: boolean;
  /** Shown at the right of the menu header, e.g. what the choice applies to. */
  context?: string;
  /** Help text under the field. */
  hint?: ReactNode;
}) {
  const labelId = useId();
  const hintId = useId();
  const optionHintId = useId();
  const [described, setDescribed] = useState<T>(value);
  const explained = options.some(([, , extra]) => extra?.hint);
  return (
    <div className={cn('iv-field', className)}>
      <span id={labelId} className={cn('iv-label', hideLabel && 'iv-sr')}>
        {label}
      </span>
      <SelectPrimitive.Root
        value={value}
        disabled={disabled}
        onOpenChange={(open) => {
          if (open) setDescribed(value);
        }}
        onValueChange={(next) => {
          const option = options.find(([key]) => key === next);
          if (option) onChange(option[0]);
        }}
      >
        <SelectPrimitive.Trigger
          className="iv-input iv-select"
          aria-labelledby={labelId}
          {...(hint ? { 'aria-describedby': hintId } : {})}
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon className="iv-select-icon">
            <ChevronsUpDown size={14} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="item-aligned"
            className={cn(layer, 'iv-select-menu')}
            data-explained={explained || undefined}
            ref={unfoldFromSelected}
          >
            {/* Header and footer sit inside the viewport: Radix measures the
                selected row from the viewport's top, so anything outside it
                would push the row off the field it is meant to cover. */}
            <SelectPrimitive.Viewport className="iv-select-viewport">
              <SelectPrimitive.Group className="iv-select-group">
                {explained && (
                  <SelectPrimitive.Label className="iv-select-head">
                    <span>{label}</span>
                    {context && <small>{context}</small>}
                  </SelectPrimitive.Label>
                )}
                {options.map(([key, text, extra], index) => (
                  <SelectPrimitive.Item
                    key={key}
                    value={key}
                    className="iv-menu-item"
                    {...(extra?.hint
                      ? { 'aria-describedby': `${optionHintId}-${index}` }
                      : {})}
                    // Radix focuses the highlighted row, pointer or keyboard.
                    onFocus={() => setDescribed(key)}
                  >
                    <SelectPrimitive.ItemText>
                      <span className="iv-option">
                        {extra?.icon}
                        <span>{text}</span>
                      </span>
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="iv-menu-check">
                      <Check size={14} />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
              {explained && (
                // Every hint is laid out in the same cell and only the
                // highlighted one is visible, so the footer is always as
                // tall as the longest hint and the menu never changes size
                // under the pointer. It follows the highlight instantly: it
                // changes as often as the pointer moves.
                <div className="iv-select-foot">
                  {options.map(([key, , extra], index) => (
                    <p
                      key={key}
                      id={`${optionHintId}-${index}`}
                      data-shown={key === described || undefined}
                    >
                      {extra?.hint}
                    </p>
                  ))}
                </div>
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {hint && (
        <p id={hintId} className="iv-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

// Where the chosen row sits inside the menu, for the unfold animation. Only
// offsets within the menu are read, so it does not matter that Radix has not
// placed the menu on screen yet.
function unfoldFromSelected(node: HTMLDivElement | null) {
  const selected = node?.querySelector<HTMLElement>('[data-state="checked"]');
  if (!node || !selected) return;
  const box = node.getBoundingClientRect();
  const row = selected.getBoundingClientRect();
  node.style.setProperty('--iv-unfold-top', `${row.top - box.top}px`);
  node.style.setProperty('--iv-unfold-bottom', `${box.bottom - row.bottom}px`);
}

/**
 * Signal bars for an ordered choice: how much of the range an option takes.
 * Carries no meaning on its own, so it is hidden from assistive tech.
 */
export function Bars({ level, of }: { level: number; of: number }) {
  return (
    <svg
      className="iv-bars"
      width={of * 3 + 1}
      height="12"
      viewBox={`0 0 ${of * 3 + 1} 12`}
      aria-hidden
    >
      {Array.from({ length: of }, (_, index) => {
        const height = 4 + (8 * index) / Math.max(1, of - 1);
        return (
          <rect
            key={index}
            x={index * 3}
            y={12 - height}
            width="2"
            height={height}
            rx="1"
            data-on={index < level || undefined}
          />
        );
      })}
    </svg>
  );
}

/**
 * A small set of exclusive choices with a sliding highlight. Native radios
 * underneath give it arrow-key movement and form semantics for free.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  tone = 'light',
  disabled = [],
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, ReactNode])[];
  className?: string;
  tone?: 'light' | 'dark';
  /** Choices shown but not open right now. */
  disabled?: readonly T[];
}) {
  const name = useId();
  return (
    <fieldset className={cn('iv-segmented', className)} data-tone={tone}>
      <legend className="iv-sr">{label}</legend>
      {options.map(([key, text]) => {
        const active = key === value;
        const off = disabled.includes(key);
        return (
          <label
            key={key}
            data-checked={active}
            data-disabled={off || undefined}
          >
            <input
              type="radio"
              className="iv-sr"
              name={name}
              value={key}
              checked={active}
              disabled={off}
              onChange={() => onChange(key)}
            />
            {active && (
              <motion.span
                layoutId={name}
                className="iv-segmented-pill"
                transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              />
            )}
            <span className="iv-segmented-label">{labelled(text)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(layer, 'iv-overlay')} />
        <Dialog.Content
          className={cn(layer, 'iv-dialog', className)}
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(event) => {
            // A form dialog starts in its first field; a confirmation keeps
            // Radix's default and lands on the first button.
            const field = (
              event.currentTarget as HTMLElement
            ).querySelector<HTMLElement>(
              'input:not([type="hidden"]), textarea',
            );
            if (!field) return;
            event.preventDefault();
            field.focus();
          }}
        >
          <div className="iv-dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="iv-icon-btn" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="iv-dialog-description">
              {description}
            </Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * A collapsible inspector group. The summary stands in for the content while
 * the group is closed, so the whole invoice stays readable at a glance.
 */
export function Section({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panel = useId();
  const root = useRef<HTMLElement>(null);
  return (
    <section className="iv-section" data-open={open} ref={root}>
      <h3>
        <button
          type="button"
          className="iv-section-head"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => {
            onToggle();
            if (open) return;
            // Once the panel has grown, bring whatever fell below the fold
            // into view. 'nearest' leaves a section that already fits alone.
            const reduce = matchMedia(
              '(prefers-reduced-motion: reduce)',
            ).matches;
            window.setTimeout(
              () =>
                root.current?.scrollIntoView({
                  block: 'nearest',
                  behavior: reduce ? 'auto' : 'smooth',
                }),
              260,
            );
          }}
        >
          <span className="iv-section-title">{title}</span>
          <span className="iv-section-summary">{summary}</span>
          <ChevronDown size={15} className="iv-section-chevron" />
        </button>
        <span className="iv-section-rule" aria-hidden />
      </h3>
      <div className="iv-section-panel" id={panel}>
        <div className="iv-section-inner" inert={!open}>
          {children}
        </div>
      </div>
    </section>
  );
}

const statusLabels: Record<DocumentStatus, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  paid: 'Paid',
  open: 'Awaiting answer',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  invoiced: 'Invoiced',
};

export function StatusChip({ status }: { status: DocumentStatus }) {
  return (
    <span className="iv-chip" data-status={status}>
      <MorphText>{statusLabels[status]}</MorphText>
    </span>
  );
}

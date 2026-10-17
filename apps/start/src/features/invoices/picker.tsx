import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn, Field, layer } from '~/features/invoices/ui';

// A picker you can type into, built as a wheel around a lens.
//
// The lens sits exactly where the field is, at the field's size, and holds
// the option that Enter would choose. Opening unfolds the panel outward from
// it, so the current choice never moves; its neighbours appear above and
// below. Arrows, a trackpad, or a click turn the wheel, and the list glides
// under the lens instead of a highlight hopping down it. Typing filters
// in place, and the best match completes as a ghost after the caret.
// Picking folds the panel back into the lens, which already shows the new
// value, so the field underneath takes over without a flicker.

/** Space kept between the panel and the window edge. */
const margin = 10;
/** The panel's padding: the lens and rows sit this far inside its edge. */
const inset = 5;
/** Rows the wheel shows at most on each side of the lens. */
const reach = { above: 4, below: 5 };

type Geometry = { row: number; above: number; below: number; width: number };

export type PickerProps<T> = {
  label: string;
  /** Names the list for assistive tech and the toggle: "countries". */
  listLabel: string;
  className?: string;
  disabled?: boolean;
  /** The chosen option's name, as the closed field shows it. */
  text: string;
  /** Options for a search; `null` means everything, in natural order. */
  options: (query: string | null) => readonly T[];
  keyOf: (option: T) => string;
  /** The option's name, as the lens and the field show it. */
  nameOf: (option: T) => string;
  /** Secondary detail at the row's right: a code, a former name. */
  aside?: (option: T) => ReactNode;
  isCurrent: (option: T) => boolean;
  /** The name that finishes what was typed, in the language it was typed. */
  complete?: (option: T, query: string) => string | undefined;
  /** The option a finished entry names outright, if any. */
  resolve: (text: string) => T | null;
  onPick: (option: T) => void;
  empty: (query: string) => string;
  placeholder?: string;
  autoComplete?: string;
  /** Change it to play the field's settle animation. */
  settle?: number;
};

/** Steps per wheel event, from pixel, line, or page deltas. */
function wheelPixels(event: WheelEvent, row: number) {
  if (event.deltaMode === 1) return event.deltaY * row;
  if (event.deltaMode === 2) return event.deltaY * row * 8;
  return event.deltaY;
}

export function Picker<T>({
  label,
  listLabel,
  className,
  disabled = false,
  text,
  options,
  keyOf,
  nameOf,
  aside,
  isCurrent,
  complete,
  resolve,
  onPick,
  empty,
  placeholder,
  autoComplete,
  settle,
}: PickerProps<T>) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const lensRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // null while not typing: the lens shows the highlighted option's name.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  // Whether the wheel's next move glides. A single step does; typing, a
  // held key, and the jump on opening move at once.
  const [glide, setGlide] = useState(false);
  const geometry = useRef<Geometry>({ row: 34, above: 0, below: 1, width: 0 });
  // How the panel is closing, decided by whatever closed it.
  const ending = useRef<'commit' | 'revert' | 'done'>('commit');
  const wheel = useRef(0);

  // Kept while closed too: the panel folds away showing the rows it had.
  const matches = options(query);
  const count = matches.length;
  // With nothing chosen and nothing typed, the wheel rests one slot before
  // the first option: the lens stays empty, as the field is, and ↓ brings
  // the first option in. Otherwise the lens always holds an option.
  const floor = query === null && !options(null).some(isCurrent) ? -1 : 0;
  const last = Math.max(count - 1, floor);
  const at = Math.min(Math.max(active, floor), last);
  const highlighted = at >= 0 ? matches[at] : undefined;
  const optionId = (option: T) => `${listId}-${keyOf(option)}`;

  // The panel is placed so its lens lands exactly on the field. Radix keeps
  // it there through scrolling: the anchor is computed from the field's
  // current box every time it is asked.
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect() {
          const box = boxRef.current?.getBoundingClientRect();
          const { row, above } = geometry.current;
          if (!box) return new DOMRect();
          return new DOMRect(
            box.left - inset,
            box.top - inset - above * row,
            box.width + inset * 2,
            0,
          );
        },
        get contextElement() {
          return boxRef.current ?? undefined;
        },
      },
    }),
    [],
  );

  function show(typed: string | null) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || disabled) return;
    fieldRef.current = boxRef.current?.querySelector('input') ?? null;
    const row = box.height;
    // As many rows as fit between the field and the window's edges, so the
    // lens never has to leave the field to make room.
    geometry.current = {
      row,
      width: box.width,
      above: Math.max(
        0,
        Math.min(reach.above, Math.floor((box.top - margin - inset) / row)),
      ),
      below: Math.max(
        1,
        Math.min(
          reach.below,
          Math.floor((window.innerHeight - box.bottom - margin - inset) / row),
        ),
      ),
    };
    const all = options(typed);
    setQuery(typed);
    setActive(typed === null ? all.findIndex(isCurrent) : 0);
    setGlide(false);
    ending.current = 'commit';
    setOpen(true);
  }

  /**
   * Ends the visit: `option` is picked, null keeps what was there. `glideIn`
   * lets a clicked row slide into the lens as the panel folds around it.
   */
  function finish(option: T | null, refocus: boolean, glideIn = false) {
    ending.current = 'done';
    if (option) {
      if (!isCurrent(option)) onPick(option);
      // The lens shows the pick while the panel folds into it.
      const all = options(null);
      setActive(
        Math.max(
          0,
          all.findIndex((entry) => keyOf(entry) === keyOf(option)),
        ),
      );
    } else {
      setActive(options(null).findIndex(isCurrent));
    }
    setGlide(glideIn);
    setQuery(null);
    setOpen(false);
    if (refocus) {
      fieldRef.current?.focus();
      reselect.current = true;
    }
  }

  // Back in the field, its name is selected, so the next key starts a new
  // search. The new name arrives a render after focus does, and writing a
  // value drops the selection, so it is selected again once it lands.
  const reselect = useRef(false);
  useLayoutEffect(() => {
    if (!reselect.current || open) return;
    const field = fieldRef.current;
    if (field && document.activeElement === field) field.select();
    reselect.current = false;
  }, [text, open]);

  // Leaving by any other route keeps a finished entry and drops a partial
  // one: what was typed has to name an option outright.
  function settleOutside() {
    if (ending.current === 'done') return;
    const revert = ending.current === 'revert';
    finish(!revert && query !== null ? resolve(query) : null, revert);
  }

  // The lens takes focus as the panel opens. Not typing, its name is
  // selected, so the first key starts a search; typing, the caret goes to
  // the end of what was typed.
  useLayoutEffect(() => {
    const lens = lensRef.current;
    if (!open || !lens || document.activeElement !== lens) return;
    if (query === null) lens.select();
  });

  // The lens turns with the wheel: when a glide brings a new option in, its
  // content arrives from the side the rows are coming from, clipped by the
  // lens, so the motion reads as one wheel rather than a list plus a label.
  const lensContent = useRef<HTMLDivElement>(null);
  const lastAt = useRef(at);
  useLayoutEffect(() => {
    const previous = lastAt.current;
    lastAt.current = at;
    const content = lensContent.current;
    if (!open || !glide || previous === at || !content) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = (at > previous ? 1 : -1) * geometry.current.row;
    content.animate(
      [{ transform: `translateY(${from}px)` }, { transform: 'translateY(0)' }],
      { duration: 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [at, open, glide]);

  // A trackpad or wheel turns the list one row per row's height of travel.
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!panel) return;
    const turn = (event: WheelEvent) => {
      event.preventDefault();
      wheel.current += wheelPixels(event, geometry.current.row);
      const steps = Math.trunc(wheel.current / geometry.current.row);
      if (!steps) return;
      wheel.current -= steps * geometry.current.row;
      setGlide(true);
      setActive((current) => Math.min(Math.max(current + steps, floor), last));
    };
    panel.addEventListener('wheel', turn, { passive: false });
    return () => panel.removeEventListener('wheel', turn);
  }, [panel, floor, last]);

  const ghost =
    query && highlighted && complete
      ? (() => {
          const name = complete(highlighted, query);
          return name?.toLowerCase().startsWith(query.toLowerCase())
            ? name.slice(query.length)
            : '';
        })()
      : '';

  // What the lens would pick, when the text in it does not already say so:
  // "alem" completes as "alemania", and Enter will choose Germany.
  const meant =
    query !== null &&
    highlighted &&
    (query + ghost).toLowerCase() !== nameOf(highlighted).toLowerCase()
      ? nameOf(highlighted)
      : null;

  function lensKeys(event: KeyboardEvent<HTMLInputElement>) {
    const lens = event.currentTarget;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // A held key follows at once; easing every repeat would leave the
      // wheel forever catching up.
      setGlide(!event.repeat);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, floor), last));
    } else if (event.key === 'Home' || event.key === 'End') {
      if (query !== null) return;
      event.preventDefault();
      setGlide(false);
      setActive(event.key === 'Home' ? floor : last);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted) finish(highlighted, true);
    } else if (event.key === 'Tab') {
      // Tab keeps what the lens shows: a ghost is taken, a finished name is
      // picked. Focus returns to the field before the browser moves it on,
      // so Tab lands on the next field, not on the panel.
      const typed = query === null ? null : query + ghost;
      finish(typed === null ? null : resolve(typed), true);
    } else if (event.key === 'ArrowRight' && ghost && query !== null) {
      const end = lens.selectionStart === query.length;
      if (!end) return;
      event.preventDefault();
      setQuery(query + ghost);
    }
  }

  const { row, above, below, width } = geometry.current;
  const seenAbove = Math.max(0, Math.min(above, at));
  const seenBelow = count
    ? Math.min(below, count - 1 - at)
    : query
      ? Math.min(below, 1)
      : 0;
  const lensTop = inset + above * row;
  const height = (above + 1 + below) * row + inset * 2;
  const style = {
    width: width + inset * 2,
    height,
    '--picker-row': `${row}px`,
    '--picker-lens-top': `${lensTop}px`,
    '--picker-lens-bottom': `${height - lensTop - row}px`,
    '--picker-surface-top': `${(above - seenAbove) * row}px`,
    '--picker-surface-height': `${(seenAbove + 1 + seenBelow) * row + inset * 2}px`,
    '--picker-clip-top': `${(above - seenAbove) * row}px`,
    '--picker-clip-bottom': `${(below - seenBelow) * row}px`,
    '--picker-shift': `${(above - at) * row}px`,
  } as CSSProperties;
  const lensText = query ?? (highlighted ? nameOf(highlighted) : text);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) settleOutside();
      }}
    >
      <Popover.Anchor virtualRef={anchor} />
      <Field
        {...(className ? { className } : {})}
        label={label}
        value={text}
        disabled={disabled}
        boxRef={boxRef}
        {...(placeholder ? { placeholder } : {})}
        {...(settle ? { settle } : {})}
        // Typing into the closed field opens the wheel with that search.
        onChange={(next) => show(next)}
        onKeyDown={(event) => {
          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp' ||
            (event.key === 'Enter' && !open)
          ) {
            event.preventDefault();
            show(null);
          }
        }}
        input={{
          role: 'combobox',
          autoComplete: autoComplete ?? 'off',
          spellCheck: false,
          'aria-expanded': open,
          'aria-controls': listId,
          onFocus: (event) => {
            fieldRef.current = event.currentTarget;
            event.currentTarget.select();
          },
          onMouseDown: (event) => {
            event.preventDefault();
            show(null);
          },
        }}
        {...(!disabled
          ? {
              end: (
                <button
                  type="button"
                  tabIndex={-1}
                  className="iv-combo-toggle"
                  aria-label={`Show ${listLabel}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => show(null)}
                >
                  <ChevronsUpDown size={14} />
                </button>
              ),
            }
          : {})}
      />
      <Popover.Portal>
        <Popover.Content
          ref={setPanel}
          side="bottom"
          align="start"
          sideOffset={0}
          avoidCollisions={false}
          className={cn(layer, 'iv-picker')}
          style={style}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const lens = lensRef.current;
            if (!lens) return;
            lens.focus();
            if (query === null) lens.select();
            else lens.setSelectionRange(query.length, query.length);
          }}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => {
            ending.current = 'revert';
          }}
        >
          <div className="iv-picker-surface" />
          <div
            className="iv-picker-rows"
            data-more-above={at - seenAbove > 0 || undefined}
            data-more-below={count - 1 - at - seenBelow > 0 || undefined}
          >
            <div
              id={listId}
              role="listbox"
              aria-label={listLabel}
              className="iv-picker-list"
              data-glide={glide || undefined}
            >
              {matches.map((option, index) => (
                // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the lens, which points here with aria-activedescendant.
                // biome-ignore lint/a11y/useKeyWithClickEvents: the lens's arrow keys and Enter drive the list.
                <div
                  key={keyOf(option)}
                  id={optionId(option)}
                  role="option"
                  aria-selected={index === at}
                  className="iv-picker-row"
                  // The lens draws the highlighted row; the row itself stays
                  // for assistive tech.
                  data-lens={index === at || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  // Unfiltered, the list stays put and the row glides home;
                  // filtered, the full list replaces it and a glide would
                  // only blur the swap.
                  onClick={() => finish(option, true, query === null)}
                >
                  <span className="iv-picker-name">{nameOf(option)}</span>
                  {aside && (
                    <span className="iv-picker-aside">{aside(option)}</span>
                  )}
                  <span className="iv-picker-check">
                    {isCurrent(option) && <Check size={14} />}
                  </span>
                </div>
              ))}
              {!count && query && (
                <p className="iv-picker-empty" style={{ top: row }}>
                  {empty(query)}
                </p>
              )}
            </div>
          </div>
          <div className="iv-picker-lens">
            <div className="iv-picker-lens-content" ref={lensContent}>
              <span className="iv-picker-type">
                <input
                  ref={lensRef}
                  className="iv-picker-input"
                  role="combobox"
                  aria-label={label}
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="both"
                  {...(highlighted
                    ? { 'aria-activedescendant': optionId(highlighted) }
                    : {})}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={`Search ${listLabel}`}
                  value={lensText}
                  onChange={(event) => {
                    setGlide(false);
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={lensKeys}
                  onBlur={() => settleOutside()}
                />
                {ghost && (
                  <span className="iv-picker-ghost" aria-hidden>
                    <span>{lensText}</span>
                    {ghost}
                  </span>
                )}
              </span>
              {meant && <span className="iv-picker-meant">{meant}</span>}
              {highlighted && aside && (
                <span className="iv-picker-aside">{aside(highlighted)}</span>
              )}
              <span className="iv-picker-check">
                {highlighted && isCurrent(highlighted) && <Check size={14} />}
              </span>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

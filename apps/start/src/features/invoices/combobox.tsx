import * as Popover from '@radix-ui/react-popover';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn, Field, layer } from './ui';

export type ComboboxProps<T> = {
  label: string;
  listLabel: string;
  className?: string;
  disabled?: boolean;
  /** The value: any text is one, and suggestions only fill it in faster. */
  text: string;
  onText: (text: string) => void;
  /** Suggestions for what was typed; `null` before anything was. */
  options: (query: string | null) => readonly T[];
  keyOf: (option: T) => string;
  render: (option: T) => ReactNode;
  onPick: (option: T) => void;
  footer?: ReactNode;
  placeholder?: string;
  autoComplete?: string;
  settle?: number;
};

/**
 * A text field that suggests as it is typed in, for values that need not be
 * on any list (a street). Choosing from a list is the Picker's job; here the
 * list sits under the field and nothing is highlighted until the owner asks,
 * so Enter never swaps what they typed for a suggestion they did not choose.
 */
export function Combobox<T>({
  label,
  listLabel,
  className,
  disabled = false,
  text,
  onText,
  options,
  keyOf,
  render,
  onPick,
  footer,
  placeholder,
  autoComplete,
  settle,
}: ComboboxProps<T>) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = options(query);
  const highlighted = open && active >= 0 ? matches[active] : undefined;
  const shown = open && matches.length > 0;
  const optionId = (option: T) => `${listId}-${keyOf(option)}`;

  // Keeps the highlighted row in view by scrolling the list itself; a
  // scrollIntoView could also scroll the page behind the list.
  useEffect(() => {
    const row = highlighted && document.getElementById(optionId(highlighted));
    if (!shown || !list || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop + 5) list.scrollTop = top - 5;
    else if (bottom > list.scrollTop + list.clientHeight - 5)
      list.scrollTop = bottom - list.clientHeight + 5;
  }, [shown, highlighted, list]);

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!matches.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((at) => Math.min(Math.max(at + step, -1), matches.length - 1));
    } else if (event.key === 'Enter' && shown && highlighted) {
      event.preventDefault();
      onPick(highlighted);
      close();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <Popover.Root
      open={shown}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <Popover.Anchor virtualRef={boxRef} />
      <Field
        {...(className ? { className } : {})}
        label={label}
        value={text}
        disabled={disabled}
        boxRef={boxRef}
        {...(placeholder ? { placeholder } : {})}
        {...(settle ? { settle } : {})}
        onChange={(next) => {
          onText(next);
          setQuery(next);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={keys}
        onBlur={close}
        input={{
          role: 'combobox',
          autoComplete: autoComplete ?? 'off',
          spellCheck: false,
          'aria-expanded': shown,
          'aria-controls': listId,
          ...(highlighted
            ? { 'aria-activedescendant': optionId(highlighted) }
            : {}),
        }}
      />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          ref={setList}
          className={cn(layer, 'iv-combo')}
          // Focus stays in the field: it is where the typing goes.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (boxRef.current?.contains(event.target as Node))
              event.preventDefault();
          }}
        >
          <div id={listId} role="listbox" aria-label={listLabel}>
            {matches.map((option, index) => (
              // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the field, which points here with aria-activedescendant.
              // biome-ignore lint/a11y/useKeyWithClickEvents: the field's arrow keys and Enter drive the list.
              <div
                key={keyOf(option)}
                id={optionId(option)}
                role="option"
                aria-selected={index === active}
                className="iv-menu-item"
                data-highlighted={index === active || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => {
                  onPick(option);
                  close();
                }}
              >
                {render(option)}
              </div>
            ))}
          </div>
          {footer && <p className="iv-combo-foot">{footer}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

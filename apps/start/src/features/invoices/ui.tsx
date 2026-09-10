import * as Dialog from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { X } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { TextMorph as TorphText } from 'torph/react';

// Minimal local cn: clsx + tailwind-merge live in @portfolio/ui, which the
// start app does not depend on, so join here instead of adding a new dep.
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// MorphText names the torph TextMorph wrapper explicitly so the import no
// longer hides which morph implementation backs animated readouts. Use it
// only for the plan's list: changing totals, counts, labels, status,
// validation messages, page numbers, and translated interface text. Native
// input values and static document text stay plain elements.
export function MorphText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const props = className === undefined ? {} : { className };
  // Duration is milliseconds (Web Animations API): 220 reads as a quick
  // morph. A sub-millisecond value would complete before the first frame and
  // look like a plain React text swap.
  return (
    <TorphText {...props} respectReducedMotion duration={220}>
      {children}
    </TorphText>
  );
}

/** Kept so existing callers keep working. New code uses MorphText. */
export const Morph = MorphText;

export function Field({
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  name?: string;
  required?: boolean;
}) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy =
    [hint && !error ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;
  const props = {
    id,
    value,
    disabled,
    placeholder,
    name,
    required,
    'aria-invalid': !!error,
    'aria-describedby': describedBy,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <div className={cn('iv-field', className)}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} type={type} />
      )}
      {hint && !error && (
        <p id={hintId} className="iv-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="iv-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('iv-field', className)}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const option = options.find(([key]) => key === event.target.value);
          if (option) onChange(option[0]);
        }}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  className?: string;
}) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={(next) => {
        const option = options.find(([key]) => key === next);
        if (option) onChange(option[0]);
      }}
    >
      <TabsPrimitive.List
        className={cn('iv-tabs', className)}
        aria-label={label}
      >
        {options.map(([key, text]) => (
          <TabsPrimitive.Trigger key={key} value={key}>
            {text}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="iv-check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
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
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="iv-dialog-overlay" />
        <Dialog.Content className={cn('iv-dialog', className)}>
          <div className="iv-dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

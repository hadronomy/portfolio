import { forwardRef, useState } from 'react';

// A one-time code drawn as six slots over one real input. The input stays a
// single native field, so autofill from the mail app, paste, the numeric
// keyboard, and screen readers all work as they do on any text field; the
// slots only show what it holds and where the next digit goes.

export const codeLength = 6;

/** Where the code stands: being typed, being checked, refused, or accepted. */
export type CodeState = 'typing' | 'checking' | 'wrong' | 'accepted';

export const CodeField = forwardRef<
  HTMLInputElement,
  {
    id: string;
    value: string;
    state: CodeState;
    describedBy?: string | undefined;
    onChange: (digits: string) => void;
  }
>(function CodeField({ id, value, state, describedBy, onChange }, ref) {
  const [focused, setFocused] = useState(false);
  const busy = state === 'checking' || state === 'accepted';
  return (
    <div className="iv-otp" data-state={state}>
      <input
        ref={ref}
        id={id}
        className="iv-otp-input"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={codeLength}
        spellCheck={false}
        value={value}
        readOnly={busy}
        aria-invalid={state === 'wrong'}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, '').slice(0, codeLength))
        }
      />
      <div className="iv-otp-slots" aria-hidden>
        {Array.from({ length: codeLength }, (_, index) => {
          const digit = value[index];
          const active =
            focused &&
            !busy &&
            index === Math.min(value.length, codeLength - 1);
          return (
            <span
              // Keyed by the digit, so each new digit settles in once.
              key={`${index}:${digit ?? ''}`}
              className="iv-otp-slot"
              data-active={active || undefined}
              data-filled={digit ? true : undefined}
            >
              {digit ?? (active && <span className="iv-otp-caret" />)}
            </span>
          );
        })}
      </div>
    </div>
  );
});

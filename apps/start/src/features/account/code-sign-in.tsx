import type { Language } from '@portfolio/invoices/model';
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { authClient } from '../auth/client';
import { SuccessCheck } from '../invoices/toast';
import { Button, MorphText } from '../invoices/ui';
import { CodeField, type CodeState, codeLength } from './code-field';
import { type AccountWords, accountWords } from './words';

// Sign-in by a code sent to an inbox, in two steps on one form: the address,
// then the code. A fixed address skips the first step, as on a payment link,
// where the invoice already says who it is billed to. The code checks itself
// once all six digits are in, so the second step has no button to press.

/** Seconds before another code may be asked for; the server allows three a minute. */
const resendWait = 30;

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function failure(
  t: AccountWords,
  error: { code?: string | undefined; status: number },
) {
  if (error.status === 429) return t.slowDown;
  switch (error.code) {
    case 'INVALID_OTP':
      return t.wrong;
    case 'OTP_EXPIRED':
      return t.expired;
    case 'TOO_MANY_ATTEMPTS':
      return t.tooMany;
    case 'no_invoices':
      return t.closed;
    default:
      return t.failed;
  }
}

/** Replays the transitions.dev error shake on an element. */
function shake(ref: RefObject<HTMLElement | null>) {
  const element = ref.current;
  if (!element) return;
  element.classList.remove('iv-shake');
  void element.offsetWidth;
  element.classList.add('iv-shake');
}

/** Whole seconds left until `until`, ticking while there are any. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export function CodeSignIn({
  language,
  email: fixed,
  emphasis = 'primary',
  onSignedIn,
}: {
  language: Language;
  /** The only address this form signs in, when the page already knows it. */
  email?: string;
  /** Secondary where another action owns the page, such as paying. */
  emphasis?: 'primary' | 'secondary';
  onSignedIn: () => void;
}) {
  const t = accountWords[language];
  const emailId = useId();
  const codeId = useId();
  const messageId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'address' | 'code'>('address');
  const [email, setEmail] = useState(fixed ?? '');
  const [code, setCode] = useState('');
  const [state, setState] = useState<CodeState>('typing');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<'sent' | 'resent'>('sent');
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const wait = useCountdown(resendAt);
  const address = email.trim();

  // The code field is the only thing left to do once the email is out.
  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const refuse = (message: string, focus: HTMLInputElement | null) => {
    setError(message);
    shake(shakeRef);
    focus?.focus();
  };

  const send = async (again: boolean) => {
    if (!again && !looksLikeEmail(address))
      return refuse(t.emailMissing, emailRef.current);
    setSending(true);
    setError('');
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: 'sign-in',
    });
    setSending(false);
    if (error) return refuse(failure(t, error), null);
    setCode('');
    setState('typing');
    setNote(again ? 'resent' : 'sent');
    setResendAt(Date.now() + resendWait * 1000);
    setStep('code');
    if (again) codeRef.current?.focus();
  };

  const verify = async (otp: string) => {
    setState('checking');
    setError('');
    const { error } = await authClient.signIn.emailOtp({ email: address, otp });
    if (error) {
      setState('wrong');
      refuse(failure(t, error), codeRef.current);
      // The wrong digits stay on screen; the next keystroke replaces them.
      codeRef.current?.select();
      return;
    }
    setState('accepted');
    onSignedIn();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 'address') {
      if (!sending) void send(false);
    } else if (code.length === codeLength && state === 'typing') {
      void verify(code);
    }
  };

  const shown = <strong className="iv-code-address">{address}</strong>;

  return (
    <form className="iv-code" onSubmit={submit} noValidate>
      {step === 'address' ? (
        <div className="iv-code-step" data-step="address" key="address">
          {fixed ? (
            <p className="iv-code-note">{t.sendTo(shown)}</p>
          ) : (
            <div
              className="iv-field"
              ref={shakeRef}
              data-invalid={error ? 'true' : undefined}
            >
              <label htmlFor={emailId}>{t.email}</label>
              <input
                ref={emailRef}
                id={emailId}
                className="iv-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                aria-invalid={!!error}
                aria-describedby={error ? messageId : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                }}
              />
            </div>
          )}
          <p
            id={messageId}
            className="iv-code-status"
            data-tone="error"
            role="alert"
          >
            {error}
          </p>
          <Button type="submit" variant={emphasis} disabled={sending}>
            <MorphText>{sending ? t.sending : t.send}</MorphText>
          </Button>
        </div>
      ) : (
        <div className="iv-code-step" data-step="code" key="code">
          <p className="iv-code-note">
            {note === 'resent'
              ? t.resent
              : fixed
                ? t.sent(shown)
                : t.sentTo(shown)}
          </p>
          <div className="iv-field" ref={shakeRef}>
            <label htmlFor={codeId}>{t.code}</label>
            <CodeField
              ref={codeRef}
              id={codeId}
              value={code}
              state={state}
              describedBy={messageId}
              onChange={(digits) => {
                setCode(digits);
                setError('');
                setState('typing');
                // A pasted or autofilled code checks itself.
                if (digits.length === codeLength) void verify(digits);
              }}
            />
          </div>
          <p
            id={messageId}
            className="iv-code-status"
            data-tone={error ? 'error' : undefined}
            role={error ? 'alert' : 'status'}
          >
            {error ||
              (state === 'checking' && t.verifying) ||
              (state === 'accepted' && (
                <>
                  <SuccessCheck />
                  {t.verified}
                </>
              ))}
          </p>
          <div className="iv-code-actions">
            <Button
              variant="ghost"
              size="sm"
              className="iv-flush"
              disabled={sending || wait > 0 || state === 'accepted'}
              onClick={() => void send(true)}
            >
              <span className="iv-num">
                {wait > 0 ? t.resendIn(wait) : t.resend}
              </span>
            </Button>
            {!fixed && (
              <Button
                variant="ghost"
                size="sm"
                className="iv-flush-end"
                disabled={state === 'checking' || state === 'accepted'}
                onClick={() => {
                  setError('');
                  setCode('');
                  setState('typing');
                  setStep('address');
                  requestAnimationFrame(() => emailRef.current?.focus());
                }}
              >
                {t.other}
              </Button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { InvoiceData, InvoiceId } from '@portfolio/invoices/model';
import * as Dialog from '@radix-ui/react-dialog';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Check, CornerDownLeft, FileText, Reply, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { emailQuoteLink, previewQuoteEmail, quoteNoteLimit } from './api';
import { Button, cn, layer, MorphText } from './ui';

// Emailing a quote: who it goes to, a few words of the owner's own, and,
// beside them, the email itself as the customer will get it, redrawn as
// they type. Nothing is minted or sent until they press Send.

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const shortDay = (day: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(day.length === 10 ? `${day}T12:00:00Z` : day));

/** `value`, once it has held still for `delay` ms. */
function useSettled<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * The email as an image of itself. Two frames take turns: the next version
 * loads in the hidden one and swaps in once it has drawn, so typing never
 * flashes the preview white. Frames run no scripts; same-origin only so
 * the page can read how tall the email is.
 */
function EmailFrame({ html, title }: { html: string; title: string }) {
  const [front, setFront] = useState(0);
  const [docs, setDocs] = useState<[string, string]>([html, '']);
  const [height, setHeight] = useState(640);
  const frames = [
    useRef<HTMLIFrameElement>(null),
    useRef<HTMLIFrameElement>(null),
  ];
  useEffect(() => {
    setDocs((current) => {
      if (current[front] === html) return current;
      const next: [string, string] = [...current];
      next[1 - front] = html;
      return next;
    });
  }, [html, front]);
  const loaded = (index: number) => {
    const frame = frames[index]?.current;
    const body = frame?.contentDocument?.documentElement;
    if (!frame || !body || docs[index] !== html) return;
    setHeight(body.scrollHeight);
    setFront(index);
  };
  return (
    <div className="iv-compose-frames" style={{ height }}>
      {docs.map((doc, index) => (
        <iframe
          key={index}
          ref={frames[index]}
          title={title}
          srcDoc={doc}
          sandbox="allow-same-origin"
          tabIndex={index === front ? 0 : -1}
          aria-hidden={index !== front}
          data-front={index === front || undefined}
          onLoad={() => loaded(index)}
        />
      ))}
    </div>
  );
}

const refusals: Record<string, string> = {
  draft: 'Issue the quote before you send it.',
  expired: 'This quote has expired. Revise it to send a new version.',
  answered: 'The customer has already answered this quote.',
  mail: 'The email did not go out, and nothing was recorded. Try again in a moment.',
};

export function QuoteEmailDialog({
  id,
  data,
  number,
  open,
  onOpenChange,
  onSent,
}: {
  id: InvoiceId;
  data: InvoiceData;
  number: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (to: string) => void;
}) {
  const toId = useId();
  const noteId = useId();
  const hintId = useId();
  const [to, setTo] = useState(data.customer.email);
  const [note, setNote] = useState('');
  const [copy, setCopy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shake = useRef<HTMLDivElement>(null);
  const settledNote = useSettled(note, 280);
  const customerWords = translate(data.language);
  const firstName = data.customer.name.trim().split(/\s+/)[0] ?? '';
  const language = translate('en')(m.notice_contract_language, {
    language: data.language,
  });
  const valid = looksLikeEmail(to);
  const near = note.length > quoteNoteLimit * 0.8;

  const preview = useQuery({
    queryKey: ['quote-email-preview', id, settledNote],
    queryFn: () => previewQuoteEmail({ data: { id, note: settledNote } }),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const send = useMutation({
    mutationFn: () =>
      emailQuoteLink({ data: { id, to: to.trim(), note: note.trim(), copy } }),
    onSuccess: (result) => {
      if (!result.ok) {
        setProblem(refusals[result.reason] ?? 'The quote cannot be sent.');
        return;
      }
      // The button says Sent for a beat before the dialog lets go.
      window.setTimeout(() => {
        onOpenChange(false);
        onSent(result.to);
      }, 700);
    },
    onError: () => setProblem(refusals.mail ?? null),
  });
  const sent = send.data?.ok === true;

  const submit = () => {
    if (send.isPending || sent) return;
    setTouched(true);
    if (!valid) {
      shake.current?.classList.remove('iv-shake');
      void shake.current?.offsetWidth;
      shake.current?.classList.add('iv-shake');
      return;
    }
    setProblem(null);
    send.mutate();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(layer, 'iv-overlay')} />
        <Dialog.Content
          className={cn(layer, 'iv-compose')}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // The address is usually right; the note is what is left to do.
            event.preventDefault();
            (event.currentTarget as HTMLElement)
              .querySelector<HTMLElement>(valid ? 'textarea' : 'input')
              ?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        >
          <form
            className="iv-compose-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="iv-dialog-heading">
              <Dialog.Title>
                Email {number ? `quote ${number}` : 'the quote'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="iv-icon-btn"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <div
              ref={shake}
              className="iv-field"
              data-invalid={touched && !valid ? 'true' : undefined}
            >
              <label htmlFor={toId}>To</label>
              <input
                id={toId}
                className="iv-input"
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                value={to}
                aria-invalid={touched && !valid}
                onChange={(event) => setTo(event.target.value)}
                onBlur={() => setTouched(true)}
              />
              {data.customer.name && (
                <p className="iv-compose-who">{data.customer.name}</p>
              )}
            </div>
            <div className="iv-field">
              <label htmlFor={noteId}>
                Message <span className="iv-compose-optional">optional</span>
              </label>
              <textarea
                id={noteId}
                className="iv-input iv-compose-note"
                value={note}
                maxLength={quoteNoteLimit}
                rows={4}
                placeholder={customerWords(m.invite_note_placeholder, {
                  name: firstName,
                })}
                aria-describedby={hintId}
                onChange={(event) => setNote(event.target.value)}
              />
              <p id={hintId} className="iv-compose-hint">
                <span>Shown above the link, in {language}.</span>
                {near && (
                  <span
                    className="iv-num"
                    data-tone={
                      note.length >= quoteNoteLimit ? 'late' : undefined
                    }
                  >
                    {quoteNoteLimit - note.length}
                  </span>
                )}
              </p>
            </div>
            {data.issuer.email && (
              <label className="iv-check iv-compose-copy">
                <input
                  type="checkbox"
                  checked={copy}
                  onChange={(event) => setCopy(event.target.checked)}
                />
                <span>Send me a copy</span>
              </label>
            )}
            <ul className="iv-compose-facts">
              <li>
                <FileText size={14} aria-hidden />
                <span>{number ?? 'Quote'}.pdf attached</span>
              </li>
              {data.quote && (
                <li>
                  <Check size={14} aria-hidden />
                  <span>
                    Can be signed until {shortDay(data.quote.validUntil)}
                  </span>
                </li>
              )}
              {data.issuer.email && (
                <li>
                  <Reply size={14} aria-hidden />
                  <span>Replies go to {data.issuer.email}</span>
                </li>
              )}
            </ul>
            <div className="iv-compose-actions">
              {problem && (
                <p className="iv-compose-problem" role="alert">
                  {problem}
                </p>
              )}
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" disabled={send.isPending}>
                  <span>Cancel</span>
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="iv-compose-send"
                disabled={send.isPending}
                data-sent={sent || undefined}
              >
                {sent && <Check size={14} aria-hidden />}
                <MorphText>
                  {sent ? 'Sent' : send.isPending ? 'Sending…' : 'Send'}
                </MorphText>
                {!sent && !send.isPending && (
                  <kbd aria-hidden>
                    ⌘<CornerDownLeft size={11} />
                  </kbd>
                )}
              </Button>
            </div>
          </form>
          <section className="iv-compose-preview" aria-label="Preview">
            <dl className="iv-compose-envelope">
              <div>
                <dt>To</dt>
                <dd>{valid ? to.trim() : '—'}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{preview.data?.subject ?? ' '}</dd>
              </div>
            </dl>
            <div
              className="iv-compose-paper"
              data-loading={preview.isFetching || undefined}
            >
              {preview.data && (
                <EmailFrame
                  html={preview.data.html}
                  title={`The email to ${data.customer.name || 'the customer'}`}
                />
              )}
            </div>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

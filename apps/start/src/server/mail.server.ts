import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { Language } from '@portfolio/invoices/model';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { createTransport } from 'nodemailer';
import { AppConfig } from './config.server';

// The messages the invoice server sends: a customer's sign-in code, and the
// confirmation of a customer's answer to a quote, which the law asks for
// within 24 hours of an online acceptance (Ley 34/2002, art. 28).

/** The mail server did not take the message. */
export class MailFailure extends Schema.TaggedError<MailFailure>()(
  'MailFailure',
  { message: Schema.String },
) {}

/** A customer's answer to a quote, as its confirmation states it. */
export interface QuoteAnswerMessage {
  readonly to: string;
  /** The owner, copied so they hear of the answer at once. */
  readonly copy: string;
  readonly language: Language;
  readonly outcome: 'accepted' | 'declined';
  readonly number: string;
  readonly issuer: string;
  readonly name: string;
  readonly decidedAt: string;
  readonly digest: string;
  readonly earlyStart: boolean;
  /** Where the customer can read and download the quote again. */
  readonly url: string;
}

export interface MailerApi {
  readonly signInCode: (message: {
    readonly to: string;
    readonly code: string;
    readonly language: Language;
  }) => Effect.Effect<void, MailFailure>;
  readonly quoteAnswer: (
    message: QuoteAnswerMessage,
  ) => Effect.Effect<void, MailFailure>;
}

/** Sends customer sign-in codes. */
export class Mailer extends Context.Service<Mailer, MailerApi>()('Mailer') {}

/** How long a code works, in seconds. The message states it, so both read from here. */
export const codeLifetime = 600;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Mail as configured: SMTP when INVOICE_SMTP_URL is set; otherwise the
 * server log in development, and nowhere in production, where customer
 * accounts are then off and nothing asks for a code.
 */
export const mailerLayer = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    const { mail } = settings;
    if (!mail)
      return Mailer.of({
        signInCode: ({ to, code }) =>
          settings.production
            ? Effect.void
            : Effect.sync(() =>
                console.info(`[invoices] Sign-in code for ${to}: ${code}`),
              ),
        // Without SMTP a confirmation cannot go out; the answer still
        // stands, and stays unconfirmed in the workspace until one does.
        quoteAnswer: (message) =>
          settings.production
            ? Effect.fail(
                new MailFailure({ message: 'Mail is not configured.' }),
              )
            : Effect.sync(() =>
                console.info(
                  `[invoices] Quote answer for ${message.to}: ${translate(message.language)(m.mail_answer_subject, message)}`,
                ),
              ),
      });
    const transport = createTransport(Redacted.value(mail.url));
    return Mailer.of({
      signInCode: Effect.fn('Mailer.signInCode')(function* ({
        to,
        code,
        language,
      }) {
        const t = translate(language);
        const intro = t(m.mail_code_intro);
        const after = `${t(m.mail_code_expiry)} ${t(m.mail_code_ignore)}`;
        yield* Effect.tryPromise({
          try: () =>
            transport.sendMail({
              from: mail.from,
              to,
              subject: t(m.mail_code_subject, { code }),
              text: `${intro}\n\n${code}\n\n${after}\n`,
              html: `<div style="font-family:system-ui,sans-serif;color:#1c1c1a;line-height:1.5;max-width:28rem">
<p>${intro}</p>
<p style="font-size:28px;font-weight:600;letter-spacing:0.12em;font-variant-numeric:tabular-nums;margin:24px 0">${code}</p>
<p style="color:#6b6b66">${after}</p>
</div>`,
            }),
          catch: (error) =>
            new MailFailure({
              message: error instanceof Error ? error.message : String(error),
            }),
        });
      }),
      quoteAnswer: Effect.fn('Mailer.quoteAnswer')(function* (message) {
        const t = translate(message.language);
        const lines = [
          t(m.mail_answer_decided, message),
          message.earlyStart ? t(m.mail_answer_early_start) : '',
          t(m.mail_answer_document, message),
          t(m.mail_answer_keep),
        ].filter(Boolean);
        yield* Effect.tryPromise({
          try: () =>
            transport.sendMail({
              from: mail.from,
              to: message.to,
              cc: message.copy || undefined,
              subject: t(m.mail_answer_subject, message),
              text: `${lines.join('\n\n')}\n`,
              html: `<div style="font-family:system-ui,sans-serif;color:#1c1c1a;line-height:1.5;max-width:32rem">${lines
                .map((line) => `<p>${escapeHtml(line)}</p>`)
                .join('')}</div>`,
            }),
          catch: (error) =>
            new MailFailure({
              message: error instanceof Error ? error.message : String(error),
            }),
        });
      }),
    });
  }),
);

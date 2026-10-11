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

const words = {
  en: {
    subject: (code: string) => `${code} is your code for your invoices`,
    intro: 'Enter this code to see your invoices from Hadronomy:',
    expiry: 'It works for 10 minutes.',
    ignore: 'If you did not ask for it, you can ignore this email.',
  },
  es: {
    subject: (code: string) => `${code} es tu código para ver tus facturas`,
    intro: 'Introduce este código para ver tus facturas de Hadronomy:',
    expiry: 'Sirve durante 10 minutos.',
    ignore: 'Si no lo has pedido, puedes ignorar este correo.',
  },
} satisfies Record<Language, unknown>;

const answerWords = {
  en: {
    subject: (m: QuoteAnswerMessage) =>
      m.outcome === 'accepted'
        ? `You accepted quote ${m.number} from ${m.issuer}`
        : `You declined quote ${m.number} from ${m.issuer}`,
    body: (m: QuoteAnswerMessage) =>
      [
        m.outcome === 'accepted'
          ? `${m.name} accepted quote ${m.number} from ${m.issuer} on ${m.decidedAt} (UTC).`
          : `${m.name} declined quote ${m.number} from ${m.issuer} on ${m.decidedAt} (UTC).`,
        m.earlyStart
          ? 'You asked for the work to start within the 14-day withdrawal period. If you withdraw, you pay for the part already done, and you lose the right once the work is fully done.'
          : '',
        `The document you answered has the SHA-256 fingerprint ${m.digest}. You can read and download it at ${m.url}`,
        'Keep this email as your copy of the agreement.',
      ].filter(Boolean),
  },
  es: {
    subject: (m: QuoteAnswerMessage) =>
      m.outcome === 'accepted'
        ? `Has aceptado el presupuesto ${m.number} de ${m.issuer}`
        : `Has rechazado el presupuesto ${m.number} de ${m.issuer}`,
    body: (m: QuoteAnswerMessage) =>
      [
        m.outcome === 'accepted'
          ? `${m.name} aceptó el presupuesto ${m.number} de ${m.issuer} el ${m.decidedAt} (UTC).`
          : `${m.name} rechazó el presupuesto ${m.number} de ${m.issuer} el ${m.decidedAt} (UTC).`,
        m.earlyStart
          ? 'Pediste que el trabajo empezara dentro del plazo de desistimiento de 14 días. Si desistes, pagas la parte ya hecha, y pierdes el derecho cuando el trabajo esté completamente hecho.'
          : '',
        `El documento que respondiste tiene la huella SHA-256 ${m.digest}. Puedes leerlo y descargarlo en ${m.url}`,
        'Guarda este correo como tu copia del acuerdo.',
      ].filter(Boolean),
  },
} satisfies Record<Language, unknown>;

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
                  `[invoices] Quote answer for ${message.to}: ${answerWords[message.language].subject(message)}`,
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
        const t = words[language];
        yield* Effect.tryPromise({
          try: () =>
            transport.sendMail({
              from: mail.from,
              to,
              subject: t.subject(code),
              text: `${t.intro}\n\n${code}\n\n${t.expiry} ${t.ignore}\n`,
              html: `<div style="font-family:system-ui,sans-serif;color:#1c1c1a;line-height:1.5;max-width:28rem">
<p>${t.intro}</p>
<p style="font-size:28px;font-weight:600;letter-spacing:0.12em;font-variant-numeric:tabular-nums;margin:24px 0">${code}</p>
<p style="color:#6b6b66">${t.expiry} ${t.ignore}</p>
</div>`,
            }),
          catch: (error) =>
            new MailFailure({
              message: error instanceof Error ? error.message : String(error),
            }),
        });
      }),
      quoteAnswer: Effect.fn('Mailer.quoteAnswer')(function* (message) {
        const t = answerWords[message.language];
        const lines = t.body(message);
        yield* Effect.tryPromise({
          try: () =>
            transport.sendMail({
              from: mail.from,
              to: message.to,
              cc: message.copy || undefined,
              subject: t.subject(message),
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

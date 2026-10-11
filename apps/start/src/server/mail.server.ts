import type { Language } from '@portfolio/invoices/model';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { createTransport } from 'nodemailer';
import { AppConfig } from './config.server';

// The one message the invoice server sends: a customer's sign-in code.

/** The mail server did not take the message. */
export class MailFailure extends Schema.TaggedError<MailFailure>()(
  'MailFailure',
  { message: Schema.String },
) {}

export interface MailerApi {
  readonly signInCode: (message: {
    readonly to: string;
    readonly code: string;
    readonly language: Language;
  }) => Effect.Effect<void, MailFailure>;
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
    });
  }),
);

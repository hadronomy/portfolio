import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { planTerms } from '@portfolio/invoices/billing';
import { calculate, formatMoney } from '@portfolio/invoices/calculate';
import type { Invoice, Language } from '@portfolio/invoices/model';
import type { QuoteResponse } from '@portfolio/invoices/quote-model';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import type { ReactElement } from 'react';
import { render } from 'react-email';
import { Resend } from 'resend';
import sharp from 'sharp';
import { QuoteAnswer } from '../emails/quote-answer';
import { QuoteAnswered } from '../emails/quote-answered';
import { QuoteInvitation } from '../emails/quote-invitation';
import { SignInCode } from '../emails/sign-in-code';
import { AppConfig } from './config.server';

// The mail the invoice server sends, through Resend: a customer's sign-in
// code, and the answer to a quote, which the law asks to confirm within 24
// hours of an online acceptance (Ley 34/2002, art. 28). The customer gets
// the confirmation and the owner a notice of their own; on an acceptance
// both carry the signed copy.

/** Resend did not take the message. */
export class MailFailure extends Schema.TaggedError<MailFailure>()(
  'MailFailure',
  { message: Schema.String },
) {}

/** A customer's answer to a quote, with what its emails show and attach. */
export interface QuoteAnswerMail {
  readonly quote: Invoice;
  readonly response: QuoteResponse;
  /** The quote's page, where the customer can read and download it again. */
  readonly url: string;
  /** The quote in the owner's workspace. */
  readonly workspaceUrl: string;
  /** The signed copy, on an acceptance. */
  readonly signedCopy: Uint8Array | null;
}

/** A quote sent to its customer by email. */
export interface QuoteInvitationMail {
  readonly quote: Invoice;
  readonly to: string;
  /** The owner's own words, or empty. */
  readonly note: string;
  /** The customer's link, minted for this email. */
  readonly url: string;
  /** The owner's address, when they asked for a copy. */
  readonly copy: string | null;
  /** The quote's PDF in its own language, attached. */
  readonly pdf: Uint8Array;
}

/**
 * The invitation's subject and body, without sending it: what the owner's
 * compose dialog previews is exactly what goes out.
 */
export const invitationEmail = (
  message: Omit<QuoteInvitationMail, 'copy' | 'pdf'>,
) => {
  const { quote } = message;
  const { language } = quote.data;
  const t = translate(language);
  const number = quote.number ?? '';
  return compose(
    <QuoteInvitation
      locale={language}
      issuer={quote.data.issuer.name}
      number={number}
      title={quote.data.title}
      validUntil={quote.data.quote?.validUntil ?? quote.data.dueDate}
      note={message.note}
      url={message.url}
    />,
  ).pipe(
    Effect.map((body) => ({
      ...body,
      subject: t(m.invite_subject, {
        issuer: quote.data.issuer.name,
        number,
      }),
    })),
  );
};

export interface MailerApi {
  readonly signInCode: (message: {
    readonly to: string;
    readonly code: string;
    readonly language: Language;
    readonly accountUrl: string;
  }) => Effect.Effect<void, MailFailure>;
  /**
   * Confirms the answer to the customer, then tells the owner. Only the
   * customer's confirmation can fail it: the owner also sees the answer in
   * the workspace, so a lost notice is logged and let go.
   */
  readonly quoteAnswer: (
    message: QuoteAnswerMail,
  ) => Effect.Effect<void, MailFailure>;
  /** Sends a quote to its customer, replying to the owner. */
  readonly quoteInvitation: (
    message: QuoteInvitationMail,
  ) => Effect.Effect<void, MailFailure>;
}

/** Sends the invoice server's mail. */
export class Mailer extends Context.Service<Mailer, MailerApi>()('Mailer') {}

/** How long a code works, in seconds. The message states it, so both read from here. */
export const codeLifetime = 600;

/** One email, ready to go. */
interface Email {
  readonly to: string;
  /** A blind copy, for the owner's own records. */
  readonly bcc?: string | undefined;
  /** Where the reader's reply goes. */
  readonly replyTo?: string | undefined;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly attachments: readonly {
    readonly filename: string;
    readonly content: Buffer;
    readonly contentType: string;
    /** Set for an image the HTML shows inline, as `cid:<id>`. */
    readonly contentId?: string;
  }[];
  /** What the email is, for Resend's logs. */
  readonly kind: string;
  /** Resend sends one email per key and day, so a retry never doubles it. */
  readonly idempotencyKey?: string;
}

/** Where an email goes: Resend, or in development a file to open. */
type Deliver = (email: Email) => Effect.Effect<void, MailFailure>;

const compose = (element: ReactElement) =>
  Effect.promise(async () => ({
    html: await render(element),
    text: await render(element, { plainText: true }),
  }));

/** The signature's size in the email: within 240 × 84, at its own proportions. */
function signatureBox(svg: string) {
  const width = Number(svg.match(/ width="(\d+)"/)?.[1] ?? 0) || 300;
  const height = Number(svg.match(/ height="(\d+)"/)?.[1] ?? 0) || 120;
  const scale = Math.min(240 / width, 84 / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * The drawn signature as a PNG at three times its shown size: mail clients
 * do not show SVG, and Gmail drops data URLs, so it travels inline.
 */
const signaturePng = (svg: string) =>
  Effect.promise(async () => {
    const box = signatureBox(svg);
    const png = await sharp(Buffer.from(svg), { density: 216 })
      .resize({ width: box.width * 3, height: box.height * 3, fit: 'inside' })
      .png()
      .toBuffer();
    return { box, png };
  });

/**
 * The total and the accepted plan in `language`: each email speaks its
 * reader's, the customer the one they answered in, the owner English.
 */
const readout = (
  quote: Invoice,
  response: QuoteResponse,
  language: Language,
) => ({
  total: formatMoney(
    calculate(quote.data).total,
    language,
    quote.data.currency,
  ),
  plan: response.plan
    ? planTerms(response.plan, language, quote.data.currency)
    : null,
});

const makeMailer = (deliver: Deliver): MailerApi => ({
  quoteInvitation: Effect.fn('Mailer.quoteInvitation')(function* (message) {
    const { quote } = message;
    const email = yield* invitationEmail(message);
    yield* deliver({
      ...email,
      to: message.to,
      bcc: message.copy ?? undefined,
      replyTo: quote.data.issuer.email || undefined,
      attachments: [
        {
          filename: `${quote.number ?? 'quote'}.pdf`,
          content: Buffer.from(message.pdf),
          contentType: 'application/pdf',
        },
      ],
      kind: 'quote-invitation',
    });
  }),

  signInCode: Effect.fn('Mailer.signInCode')(function* ({
    to,
    code,
    language,
    accountUrl,
  }) {
    const t = translate(language);
    const body = yield* compose(
      <SignInCode locale={language} code={code} accountUrl={accountUrl} />,
    );
    yield* deliver({
      to,
      subject: t(m.mail_code_subject, { code }),
      ...body,
      attachments: [],
      kind: 'sign-in-code',
    });
  }),

  quoteAnswer: Effect.fn('Mailer.quoteAnswer')(function* ({
    quote,
    response,
    url,
    workspaceUrl,
    signedCopy,
  }) {
    const { data } = quote;
    const number = quote.number ?? '';
    const ink = response.signature
      ? yield* signaturePng(response.signature)
      : null;
    const shared = {
      outcome: response.outcome,
      issuer: data.issuer.name,
      number,
      title: data.title,
      decidedAt: response.decidedAt,
      name: response.name,
      earlyStart: response.earlyStart,
      digest: response.digest,
      signature: ink && { src: 'cid:signature', ...ink.box },
    };
    const attachments = (language: Language) => [
      ...(ink
        ? [
            {
              filename: 'signature.png',
              content: ink.png,
              contentType: 'image/png',
              contentId: 'signature',
            },
          ]
        : []),
      ...(signedCopy
        ? [
            {
              filename: `${translate(language)(m.accept_file, { number })}.pdf`,
              content: Buffer.from(signedCopy),
              contentType: 'application/pdf',
            },
          ]
        : []),
    ];
    const t = translate(response.language);
    yield* deliver({
      to: response.email,
      subject: t(m.mail_answer_subject, {
        outcome: response.outcome,
        number,
        issuer: data.issuer.name,
      }),
      ...(yield* compose(
        <QuoteAnswer
          {...shared}
          {...readout(quote, response, response.language)}
          locale={response.language}
          url={url}
        />,
      )),
      attachments: attachments(response.language),
      kind: 'quote-answer',
      idempotencyKey: `quote-answer/${response.quoteId}/customer`,
    });
    if (!data.issuer.email) return;
    const owner = translate('en');
    yield* deliver({
      to: data.issuer.email,
      subject: owner(m.owner_mail_subject, {
        outcome: response.outcome,
        name: response.name,
        number,
      }),
      ...(yield* compose(
        <QuoteAnswered
          {...shared}
          {...readout(quote, response, 'en')}
          locale="en"
          email={response.email}
          url={workspaceUrl}
          address={response.address}
          agent={response.agent}
        />,
      )),
      attachments: attachments('en'),
      kind: 'quote-answered',
      idempotencyKey: `quote-answer/${response.quoteId}/owner`,
    }).pipe(
      Effect.catchTag('MailFailure', (failure) =>
        Effect.logWarning('Quote answer notice not sent', failure.message),
      ),
    );
  }),
});

/** Sends through Resend, from the configured sender. */
const resendDeliver = (apiKey: string, from: string): Deliver => {
  const resend = new Resend(apiKey);
  return Effect.fn('Mailer.deliver')(function* (email) {
    const { error } = yield* Effect.promise(() =>
      resend.emails.send(
        {
          from,
          to: email.to,
          ...(email.bcc ? { bcc: email.bcc } : {}),
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
          subject: email.subject,
          html: email.html,
          text: email.text,
          attachments: email.attachments.map((file) => ({ ...file })),
          tags: [{ name: 'kind', value: email.kind }],
        },
        email.idempotencyKey
          ? { idempotencyKey: email.idempotencyKey }
          : undefined,
      ),
    );
    if (error) return yield* new MailFailure({ message: error.message });
  });
};

/**
 * Development without Resend: each email lands as an HTML file in the data
 * folder, attachments beside it, and the log names the file to open.
 */
const fileDeliver = (folder: string): Deliver =>
  Effect.fn('Mailer.file')(function* (email) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = join(folder, `${stamp}-${email.kind}`);
    yield* Effect.promise(async () => {
      await mkdir(folder, { recursive: true });
      await writeFile(`${base}.html`, email.html);
      await writeFile(
        `${base}.txt`,
        `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`,
      );
      for (const file of email.attachments)
        await writeFile(`${base}-${file.filename}`, file.content);
    });
    yield* Effect.logInfo(
      `Email to ${email.to}: ${email.subject}\n  ${base}.html`,
    );
  });

/**
 * Mail as configured: Resend when RESEND_API_KEY is set; otherwise files in
 * development, and nothing in production, where customer accounts are then
 * off and nothing asks for a code.
 */
export const mailerLayer = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    if (settings.mail)
      return Mailer.of(
        makeMailer(
          resendDeliver(
            Redacted.value(settings.mail.apiKey),
            settings.mail.from,
          ),
        ),
      );
    if (!settings.production)
      return Mailer.of(
        makeMailer(fileDeliver(join(settings.dataDirectory, 'mail'))),
      );
    // Without Resend a confirmation cannot go out; the answer still
    // stands, and stays unconfirmed in the workspace until one does.
    return Mailer.of({
      signInCode: () => Effect.void,
      quoteAnswer: () =>
        Effect.fail(new MailFailure({ message: 'Mail is not configured.' })),
      quoteInvitation: () =>
        Effect.fail(new MailFailure({ message: 'Mail is not configured.' })),
    });
  }),
);

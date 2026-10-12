import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { planTerms } from '@portfolio/invoices/billing';
import { calculate, formatMoney } from '@portfolio/invoices/calculate';
import { Documents } from '@portfolio/invoices/documents';
import {
  type Invoice,
  InvoiceId,
  type Language,
  type OwnerDid,
  type StorageFailure,
} from '@portfolio/invoices/model';
import {
  type ClaimedMail,
  idempotencyWindow,
  type MailRetryRefused,
  Outbox,
} from '@portfolio/invoices/outbox';
import type {
  MailDelivery,
  PreparedMail,
} from '@portfolio/invoices/outbox-model';
import type { QuoteResponse } from '@portfolio/invoices/quote-model';
import { Quotes } from '@portfolio/invoices/quotes';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import type { ReactElement } from 'react';
import { render } from 'react-email';
import { Resend } from 'resend';
import sharp from 'sharp';
import { QuoteAnswer } from '../emails/quote-answer';
import { QuoteAnswered } from '../emails/quote-answered';
import { QuoteInvitation } from '../emails/quote-invitation';
import { SignInCode } from '../emails/sign-in-code';
import { codeLifetime } from '../features/auth/shared';
import { AppConfig } from './config.server';

/** Safe to persist: provider error bodies can contain addresses and message content. */
export class MailFailure extends Schema.TaggedError<MailFailure>()(
  'MailFailure',
  {
    message: Schema.String,
    permanent: Schema.Boolean,
    uncertain: Schema.Boolean,
  },
) {}
const failure = (message: string, permanent = false, uncertain = false) =>
  new MailFailure({ message, permanent, uncertain });

const compose = (element: ReactElement) =>
  Effect.tryPromise({
    try: async () => ({
      html: await render(element),
      text: await render(element, { plainText: true }),
    }),
    catch: () => failure('The email could not be prepared.'),
  });

export const invitationEmail = (message: {
  readonly quote: Invoice;
  readonly to: string;
  readonly note: string;
  readonly url: string;
}) => {
  const { quote } = message;
  const language = quote.data.language;
  return compose(
    <QuoteInvitation
      locale={language}
      issuer={quote.data.issuer.name}
      number={quote.number ?? ''}
      title={quote.data.title}
      validUntil={quote.data.quote?.validUntil ?? quote.data.dueDate}
      note={message.note}
      url={message.url}
    />,
  ).pipe(
    Effect.map((body) => ({
      ...body,
      subject: translate(language)(m.invite_subject, {
        issuer: quote.data.issuer.name,
        number: quote.number ?? '',
      }),
    })),
  );
};

/** Resend limits the whole message to 40 MB after encoding. Reserve room for MIME headers and line folding. */
export function boundedMail(
  email: PreparedMail,
): Effect.Effect<PreparedMail, MailFailure> {
  const body =
    // Quoted-printable can expand each UTF-8 byte to three characters.
    (Buffer.byteLength(email.html) +
      Buffer.byteLength(email.text) +
      Buffer.byteLength(email.subject)) *
    3;
  const attachments = email.attachments.reduce(
    (total, file) =>
      total + file.content.length + Math.ceil(file.content.length / 76) * 2,
    0,
  );
  return body + attachments + 1_000_000 < 40_000_000
    ? Effect.succeed(email)
    : Effect.fail(
        failure(
          'This email exceeds the 40 MB encoded message limit. Use a smaller PDF.',
          true,
        ),
      );
}

const signaturePng = (svg: string) =>
  Effect.tryPromise({
    try: async () => {
      const width = Number(svg.match(/ width="(\d+)"/)?.[1] ?? 0);
      const height = Number(svg.match(/ height="(\d+)"/)?.[1] ?? 0);
      if (width <= 0 || height <= 0 || width > 4096 || height > 4096)
        throw new Error('Invalid signature size');
      const scale = Math.min(240 / width, 84 / height);
      const box = {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      };
      const png = await sharp(Buffer.from(svg), {
        density: 216,
        limitInputPixels: 16_777_216,
      })
        .resize({ width: box.width * 3, height: box.height * 3, fit: 'inside' })
        .png()
        .toBuffer();
      return { box, png };
    },
    catch: () => failure('The signature image could not be prepared.', true),
  });
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

export interface MailerApi {
  readonly signInCode: (message: {
    readonly to: string;
    readonly code: string;
    readonly language: Language;
    readonly accountUrl: string;
  }) => Effect.Effect<void, MailFailure>;
  readonly send: (
    email: string,
  ) => Effect.Effect<MailDelivery | null, StorageFailure>;
  readonly quote: (
    id: InvoiceId,
  ) => Effect.Effect<readonly MailDelivery[], StorageFailure>;
  readonly drain: () => Effect.Effect<
    { readonly attempted: number },
    StorageFailure
  >;
  readonly retry: (
    id: InvoiceId,
    email: string,
    actor: OwnerDid,
  ) => Effect.Effect<MailDelivery, StorageFailure | MailRetryRefused>;
}
export class Mailer extends Context.Service<Mailer, MailerApi>()('Mailer') {}

type Deliver = (
  mail: ClaimedMail,
  body: PreparedMail,
) => Effect.Effect<string, MailFailure>;

/** Returns the provider ID, with every retry carrying the row's stable key. */
export const resendDeliver = (resend: Resend): Deliver =>
  Effect.fn('Mailer.resend')(function* (mail, body) {
    const { data, error } = yield* Effect.tryPromise({
      try: (signal) =>
        resend.emails.send(
          {
            from: body.from,
            subject: body.subject,
            html: body.html,
            text: body.text,
            ...(body.replyTo ? { replyTo: body.replyTo } : {}),
            to: mail.recipient,
            attachments: body.attachments.map(({ contentId, ...file }) => ({
              ...file,
              ...(contentId ? { contentId } : {}),
            })),
            tags: [{ name: 'kind', value: mail.kind }],
          },
          { idempotencyKey: mail.idempotencyKey, signal },
        ),
      catch: () =>
        failure(
          'The mail provider did not answer. Delivery is uncertain.',
          false,
          true,
        ),
    });
    if (error) {
      const refusals = [
        'validation_error',
        'missing_required_field',
        'invalid_parameter',
        'invalid_idempotency_key',
        'invalid_idempotent_request',
        'invalid_attachment',
        'invalid_from_address',
        'invalid_access',
        'restricted_api_key',
        'missing_api_key',
        'invalid_api_key',
        'invalid_region',
        'security_error',
      ];
      const transient = [
        'rate_limit_exceeded',
        'daily_quota_exceeded',
        'monthly_quota_exceeded',
      ];
      const permanent = refusals.includes(error.name);
      // Unknown responses and server faults can follow a successful send.
      const uncertain =
        error.name === 'invalid_idempotent_request' ||
        (!permanent && !transient.includes(error.name));
      const name =
        permanent || transient.includes(error.name)
          ? error.name
          : 'uncertain_delivery';
      return yield* failure(
        `The mail provider refused the email (${name}).`,
        permanent,
        uncertain,
      );
    }
    if (!data?.id)
      return yield* failure(
        'The mail provider returned no message ID. Delivery is uncertain.',
        false,
        true,
      );
    return data.id;
  });

const fileDeliver = (folder: string): Deliver =>
  Effect.fn('Mailer.file')(function* (mail, body) {
    // The row ID gives local delivery the same retry identity as Resend.
    const base = join(folder, `${mail.id}-${mail.kind}`);
    yield* Effect.tryPromise({
      try: async () => {
        await mkdir(folder, { recursive: true });
        await writeFile(`${base}.html`, body.html);
        await writeFile(
          `${base}.txt`,
          `To: ${mail.recipient}\nSubject: ${body.subject}\n\n${body.text}\n`,
        );
        for (const file of body.attachments)
          await writeFile(
            `${base}-${file.filename.replace(/[/\\]/g, '-')}`,
            Buffer.from(file.content, 'base64'),
          );
      },
      catch: () => failure('The development email file could not be written.'),
    });
    yield* Effect.logInfo('Development email written', {
      id: mail.id,
      kind: mail.kind,
    });
    return `file:${mail.id}`;
  });

export const mailerLayer = Layer.effect(
  Mailer,
  Effect.gen(function* () {
    const settings = yield* AppConfig;
    const outbox = yield* Outbox;
    const documents = yield* Documents;
    const quotes = yield* Quotes;
    const deliver: Deliver = settings.mail
      ? resendDeliver(new Resend(Redacted.value(settings.mail.apiKey)))
      : !settings.production
        ? fileDeliver(join(settings.dataDirectory, 'mail'))
        : () => Effect.fail(failure('Mail is not configured.'));
    const from = settings.mail?.from ?? 'invoices@localhost.test';

    const prepare = Effect.fn('Mailer.prepare')(function* (mail: ClaimedMail) {
      const payload = mail.payload;
      if (payload._tag === 'Code') {
        const body = yield* compose(
          <SignInCode
            locale={payload.language}
            code={payload.code}
            accountUrl={payload.accountUrl}
          />,
        );
        return {
          from,
          ...body,
          subject: translate(payload.language)(m.mail_code_subject, {
            code: payload.code,
          }),
          attachments: [],
        };
      }
      if (!mail.invoiceId)
        return yield* failure('This email has no document.', true);
      const id = InvoiceId.make(mail.invoiceId);
      const { quote, response } = yield* quotes.view(id);
      if (payload._tag === 'Invitation') {
        // A queued invitation must not reopen a link the owner closed.
        const token = new URL(payload.url).pathname.split('/').at(-1) ?? '';
        yield* quotes.resolve(token).pipe(
          Effect.catchTags({
            LinkInvalid: () =>
              Effect.fail(
                failure(
                  'The invitation link is closed. Send a new invitation.',
                  true,
                ),
              ),
            QuoteClosed: () =>
              Effect.fail(failure('This document is not a quote.', true)),
          }),
        );
        if (response)
          return yield* failure(
            'The customer already answered this quote.',
            true,
          );
        const email = yield* invitationEmail({
          quote,
          to: mail.recipient,
          note: payload.note,
          url: payload.url,
        });
        const pdf = yield* documents.pdf(id, quote.data.language);
        return {
          from,
          ...email,
          ...(quote.data.issuer.email
            ? { replyTo: quote.data.issuer.email }
            : {}),
          attachments: [
            {
              filename: `${quote.number ?? 'quote'}.pdf`,
              content: Buffer.from(pdf.bytes).toString('base64'),
              contentType: 'application/pdf',
            },
          ],
        };
      }
      if (!response)
        return yield* failure('This quote has no answer to confirm.', true);
      const owner = mail.kind === 'quote-answered';
      const language = owner ? 'en' : response.language;
      const t = translate(language);
      const number = quote.number ?? '';
      const ink = response.signature
        ? yield* signaturePng(response.signature)
        : null;
      const shared = {
        outcome: response.outcome,
        issuer: quote.data.issuer.name,
        number,
        title: quote.data.title,
        decidedAt: response.decidedAt,
        name: response.name,
        earlyStart: response.earlyStart,
        digest: response.digest,
        signature: ink && { src: 'cid:signature', ...ink.box },
        ...readout(quote, response, language),
        locale: language,
      };
      const body = yield* compose(
        owner ? (
          <QuoteAnswered
            {...shared}
            email={response.email}
            url={payload.workspaceUrl}
            address={response.address}
            agent={response.agent}
          />
        ) : (
          <QuoteAnswer {...shared} url={payload.url} />
        ),
      );
      const signed =
        response.outcome === 'accepted'
          ? yield* documents.signed(quote, response)
          : null;
      return {
        from,
        ...body,
        subject: owner
          ? t(m.owner_mail_subject, {
              outcome: response.outcome,
              name: response.name,
              number,
            })
          : t(m.mail_answer_subject, {
              outcome: response.outcome,
              number,
              issuer: quote.data.issuer.name,
            }),
        attachments: [
          ...(ink
            ? [
                {
                  filename: 'signature.png',
                  content: ink.png.toString('base64'),
                  contentType: 'image/png',
                  contentId: 'signature',
                },
              ]
            : []),
          ...(signed
            ? [
                {
                  filename: `${t(m.accept_file, { number })}.pdf`,
                  content: Buffer.from(signed).toString('base64'),
                  contentType: 'application/pdf',
                },
              ]
            : []),
        ],
      };
    });

    const attempt = Effect.fn('Mailer.attempt')(function* (mail: ClaimedMail) {
      yield* Effect.gen(function* () {
        if (mail.expiresAt && Date.parse(mail.expiresAt) <= Date.now())
          return yield* failure(
            'This email expired before it could be sent.',
            true,
          );
        if (
          mail.firstAttemptAt &&
          Date.now() - Date.parse(mail.firstAttemptAt) >= idempotencyWindow
        )
          return yield* failure(
            'Delivery needs review: its idempotency key has expired.',
            true,
            mail.uncertain,
          );
        if (settings.production && !settings.mail)
          return yield* failure('Mail is not configured.');
        if (mail.payload._tag === 'Invitation') {
          yield* quotes
            .resolve(new URL(mail.payload.url).pathname.split('/').at(-1) ?? '')
            .pipe(
              Effect.catchTags({
                LinkInvalid: () =>
                  Effect.fail(
                    failure(
                      'The invitation link is closed. Send a new invitation.',
                      true,
                    ),
                  ),
                QuoteClosed: () =>
                  Effect.fail(failure('This document is not a quote.', true)),
              }),
            );
          if (
            mail.invoiceId &&
            (yield* quotes.view(InvoiceId.make(mail.invoiceId))).response
          )
            return yield* failure(
              'The customer already answered this quote.',
              true,
            );
        }
        const body = yield* boundedMail(
          mail.prepared ?? (yield* prepare(mail)),
        );
        if (!mail.prepared && !(yield* outbox.prepare(mail, body))) return;
        if (!(yield* outbox.sending(mail))) return;
        const messageId = yield* deliver(mail, body).pipe(
          Effect.timeout('20 seconds'),
          Effect.catchTag('TimeoutError', () =>
            Effect.fail(
              failure(
                'The mail provider timed out. Delivery is uncertain.',
                false,
                true,
              ),
            ),
          ),
        );
        yield* outbox.sent(mail, messageId);
      }).pipe(
        Effect.catchTags({
          MailFailure: (error) =>
            outbox.failed(
              mail,
              error.message,
              error.permanent,
              error.uncertain,
            ),
          AcceptedPdfMismatch: () =>
            outbox.failed(
              mail,
              'The stored PDF does not match the accepted digest.',
              true,
              false,
            ),
          QuoteClosed: () =>
            outbox.failed(
              mail,
              'The quote cannot prepare this email.',
              true,
              false,
            ),
          MissingInvoice: () =>
            outbox.failed(
              mail,
              'The document for this email is missing.',
              true,
              false,
            ),
          InvalidInvoice: () =>
            outbox.failed(
              mail,
              'The document for this email is invalid.',
              true,
              false,
            ),
          RevisionConflict: () =>
            outbox.failed(
              mail,
              'The document changed while preparing the email.',
              false,
              false,
            ),
        }),
        Effect.catchDefect(() =>
          outbox.failed(
            mail,
            'This email could not be prepared or sent.',
            false,
            true,
          ),
        ),
      );
    });
    const send = Effect.fn('Mailer.send')(function* (id: string) {
      const mail = yield* outbox.claim(id);
      if (mail) yield* attempt(mail);
      return yield* outbox.read(id);
    });
    return Mailer.of({
      send,
      quote: Effect.fn('Mailer.quote')(function* (id) {
        const deadline = Date.now() + 35_000;
        let attempted = 0;
        for (const row of yield* outbox.deliveries(id)) {
          if (attempted >= 10 || Date.now() >= deadline) break;
          if (row.state === 'pending') {
            yield* send(row.id);
            attempted++;
          }
        }
        return yield* outbox.deliveries(id);
      }),
      drain: Effect.fn('Mailer.drain')(function* () {
        // A bounded pass fits a serverless request. The next cron handles the rest.
        const deadline = Date.now() + 35_000;
        let attempted = 0;
        while (attempted < 10 && Date.now() < deadline) {
          const mail = yield* outbox.claim();
          if (!mail) break;
          yield* attempt(mail);
          attempted++;
        }
        return { attempted };
      }),
      retry: Effect.fn('Mailer.retry')(function* (id, email, actor) {
        const row = yield* outbox.retry(id, email, actor);
        return (yield* send(row.id)) ?? row;
      }),
      signInCode: Effect.fn('Mailer.signInCode')(
        function* (message) {
          const key = `sign-in-code/${crypto.randomUUID()}`;
          yield* outbox.enqueue([
            {
              invoiceId: null,
              kind: 'sign-in-code',
              recipient: message.to,
              payload: {
                _tag: 'Code',
                code: message.code,
                language: message.language,
                accountUrl: message.accountUrl,
              },
              key,
              expiresAt: new Date(
                Date.now() + codeLifetime * 1000,
              ).toISOString(),
            },
          ]);
          // Locate this callback's row without exposing the code to the request.
          const mail = yield* outbox.byKey(key);
          if (mail) yield* send(mail.id);
        },
        (effect) =>
          effect.pipe(
            Effect.mapError(() =>
              failure('The sign-in email could not be queued.'),
            ),
          ),
      ),
    });
  }),
);

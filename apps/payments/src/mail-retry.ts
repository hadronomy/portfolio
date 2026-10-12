import {
  mailRetryPath,
  mailRetrySignature,
  mailRetrySignatureHeader,
  mailRetryTimestampHeader,
} from '@portfolio/invoices/mail-auth';
import { Config, Effect, Redacted, Schema } from 'effect';

export class MailRetryFailure extends Schema.TaggedError<MailRetryFailure>()(
  'MailRetryFailure',
  { message: Schema.String },
) {}

/** The cron awaits the web request. Serverless delivery stays inside that request's lifetime. */
export const retryMail = Effect.gen(function* () {
  const origin = yield* Config.String('INVOICE_ORIGIN');
  const secret = yield* Config.Redacted('INVOICE_MAIL_RETRY_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(new URL(mailRetryPath, origin), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(55_000),
        headers: {
          [mailRetryTimestampHeader]: timestamp,
          [mailRetrySignatureHeader]: mailRetrySignature(
            Redacted.value(secret),
            timestamp,
          ),
        },
      }),
    catch: () =>
      new MailRetryFailure({
        message: 'The web app did not answer the mail retry request.',
      }),
  });
  yield* Effect.promise(async () => {
    await response.body?.cancel();
  });
  if (!response.ok)
    return yield* new MailRetryFailure({
      message: `Mail retry returned HTTP ${response.status}.`,
    });
}).pipe(Effect.withSpan('Payments.retryMail'));

import {
  mailRetrySignatureHeader,
  mailRetryTimestampHeader,
  validMailRetry,
} from '@portfolio/invoices/mail-auth';
import { Effect, Redacted } from 'effect';
import { AppConfig } from '~/server/config.server';
import { Mailer } from '~/server/mail.server';
import { CurrentRequest, Refused } from '~/server/request.server';

export const retryDueMail = Effect.gen(function* () {
  const settings = yield* AppConfig;
  const request = yield* CurrentRequest;
  if (!settings.mailRetrySecret)
    return yield* new Refused({
      status: 503,
      message: 'Mail retry is not configured.',
    });
  if (
    request.method !== 'POST' ||
    !validMailRetry(
      Redacted.value(settings.mailRetrySecret),
      request.headers.get(mailRetryTimestampHeader) ?? '',
      request.headers.get(mailRetrySignatureHeader) ?? '',
    )
  )
    return yield* new Refused({
      status: 401,
      message: 'Invalid mail retry signature.',
    });
  const result = yield* Mailer.use((mailer) => mailer.drain()).pipe(
    Effect.catchTag('StorageFailure', () =>
      Effect.fail(
        new Refused({ status: 503, message: 'Mail retry is unavailable.' }),
      ),
    ),
  );
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
});

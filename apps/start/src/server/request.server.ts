import type { Language } from '@portfolio/invoices/model';
import { Context, Effect, Schema } from 'effect';
import { AppConfig } from './config.server';
import { applicationOrigin } from './origin.server';

// The request being served, as a service, and the one way to turn it away.
// Server code fails with Refused; the edge (serve, in runtime.ts) answers
// with its status. Nothing below the edge throws a Response.

/** The web request this effect serves. */
export class CurrentRequest extends Context.Service<CurrentRequest, Request>()(
  'CurrentRequest',
) {}

/** A request the server turns away, with the status and words it answers. */
export class Refused extends Schema.TaggedError<Refused>()('Refused', {
  status: Schema.Int,
  message: Schema.String,
}) {}

/** The public origin this request was made to: the configured one, or in development the loopback host the browser used. */
export const origin = Effect.gen(function* () {
  const settings = yield* AppConfig;
  const request = yield* CurrentRequest;
  return applicationOrigin(request, {
    configured: settings.origin,
    production: settings.production,
  });
});

/** Refuses a cross-origin mutation, so only the invoice pages themselves can change data. */
export const sameOrigin = Effect.gen(function* () {
  const request = yield* CurrentRequest;
  if (request.headers.get('origin') !== (yield* origin))
    return yield* new Refused({
      status: 403,
      message: 'Invalid request origin.',
    });
});

/** The language a page speaks before it knows the visitor: the browser's, when it is one the invoices speak. */
export const requestLanguage = CurrentRequest.useSync(
  (request): Language =>
    (request.headers.get('accept-language') ?? '')
      .toLowerCase()
      .startsWith('es')
      ? 'es'
      : 'en',
);

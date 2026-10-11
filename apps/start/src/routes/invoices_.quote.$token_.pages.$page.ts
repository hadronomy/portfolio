import { Language } from '@portfolio/invoices/model';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { quotePageImage } from '../features/invoices/quotes.server';
import { Refused } from '../server/request.server';
import { serve } from '../server/runtime.server';

const Query = Schema.Struct({
  lang: Language,
  v: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  page: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 999 }),
  ),
});

export const Route = createFileRoute('/invoices_/quote/$token_/pages/$page')({
  server: {
    handlers: {
      GET: ({ params, request }) => {
        const search = new URL(request.url).searchParams;
        return serve(
          Schema.decodeUnknownEffect(Query)({
            lang: search.get('lang'),
            v: search.get('v'),
            page: params.page,
          }).pipe(
            Effect.mapError(
              () => new Refused({ status: 404, message: 'No such page.' }),
            ),
            Effect.flatMap(({ lang, v, page }) =>
              quotePageImage(params.token, lang, v, page),
            ),
          ),
          request,
        );
      },
    },
  },
});

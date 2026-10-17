import { Language } from '@portfolio/invoices/model';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { quotePdf } from '~/features/invoices/quotes.server';
import { Refused } from '~/server/request.server';
import { serve } from '~/server/runtime.server';

export const Route = createFileRoute('/invoices_/quote/$token_/pdf')({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        serve(
          Schema.decodeUnknownEffect(Language)(
            new URL(request.url).searchParams.get('lang') ?? 'en',
          ).pipe(
            Effect.mapError(
              () =>
                new Refused({ status: 400, message: 'Unsupported language.' }),
            ),
            Effect.flatMap((language) => quotePdf(params.token, language)),
          ),
          request,
        ),
    },
  },
});

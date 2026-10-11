import { InvoiceId, Language } from '@portfolio/invoices/model';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Schema } from 'effect';
import { download } from '../features/invoices/operations.server';
import { Refused } from '../server/request.server';
import { serve } from '../server/runtime.server';

export const Route = createFileRoute('/invoices_/pdf/$invoiceId')({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        serve(
          Effect.gen(function* () {
            const id = yield* Schema.decodeUnknownEffect(InvoiceId)(
              params.invoiceId,
            ).pipe(
              Effect.mapError(
                () =>
                  new Refused({ status: 404, message: 'Invoice not found.' }),
              ),
            );
            const language = yield* Schema.decodeUnknownEffect(Language)(
              new URL(request.url).searchParams.get('lang') ?? 'en',
            ).pipe(
              Effect.mapError(
                () =>
                  new Refused({
                    status: 400,
                    message: 'Unsupported language.',
                  }),
              ),
            );
            return yield* download(id, language);
          }),
          request,
        ),
    },
  },
});

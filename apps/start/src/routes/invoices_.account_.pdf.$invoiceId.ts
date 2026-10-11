import { InvoiceId, Language } from '@portfolio/invoices/model';
import { createFileRoute } from '@tanstack/react-router';
import { Effect, Option, Schema } from 'effect';
import { customerPdf } from '../features/account/account.server';
import { Refused } from '../server/request.server';
import { serve } from '../server/runtime.server';

export const Route = createFileRoute('/invoices_/account_/pdf/$invoiceId')({
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
            // Without a language the PDF speaks the invoice's own.
            const lang = Option.fromNullishOr(
              new URL(request.url).searchParams.get('lang'),
            );
            const language = Option.isSome(lang)
              ? yield* Schema.decodeUnknownEffect(Language)(lang.value).pipe(
                  Effect.mapError(
                    () =>
                      new Refused({
                        status: 400,
                        message: 'Unsupported language.',
                      }),
                  ),
                )
              : undefined;
            return yield* customerPdf(id, language);
          }),
          request,
        ),
    },
  },
});

import { InvoiceId, Language } from '@portfolio/invoices/model';
import { createFileRoute } from '@tanstack/react-router';
import { Result, Schema } from 'effect';

export const Route = createFileRoute('/invoices_/pdf/$invoiceId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = Schema.decodeUnknownResult(InvoiceId)(params.invoiceId);
        if (Result.isFailure(id))
          throw new Response('Invoice not found.', { status: 404 });
        const language = Schema.decodeUnknownResult(Language)(
          new URL(request.url).searchParams.get('lang') ?? 'en',
        );
        if (Result.isFailure(language))
          throw new Response('Unsupported language.', { status: 400 });
        const { download } = await import(
          '../features/invoices/operations.server'
        );
        return download(id.success, language.success);
      },
    },
  },
});

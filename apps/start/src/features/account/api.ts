import { InvoiceId } from '@portfolio/invoices/model';
import { createServerFn } from '@tanstack/react-start';
import { Result, Schema } from 'effect';
import { accountInvoice, accountPage } from '~/features/account/account.server';
import { serve } from '~/server/runtime.server';

// Client/server seam, as in features/invoices/api.ts: the build swaps each
// handler for an RPC stub in client bundles.
export const getAccountPage = createServerFn({ method: 'GET' }).handler(() =>
  serve(accountPage()),
);

export const getAccountInvoice = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    const decoded = Schema.decodeUnknownResult(
      Schema.Struct({ id: InvoiceId }),
    )(input);
    if (Result.isFailure(decoded))
      throw new Response('Invoice not found.', { status: 404 });
    return decoded.success;
  })
  .handler(({ data }) => serve(accountInvoice(data.id)));

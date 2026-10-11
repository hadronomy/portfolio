import { createFileRoute, redirect } from '@tanstack/react-router';
import { MissingInvoicePage } from '../features/account/account';
import { getAccountInvoice } from '../features/account/api';
import { PaymentPage } from '../features/invoices/pay';

export const Route = createFileRoute('/invoices_/account_/$invoiceId')({
  loader: async ({ params }) => {
    const found = await getAccountInvoice({ data: { id: params.invoiceId } });
    // Signed out, the invoice is one sign-in away; the list asks for it.
    if (found._tag === 'SignedOut') throw redirect({ to: '/invoices/account' });
    return found;
  },
  head: ({ loaderData }) => {
    const invoice =
      loaderData?._tag === 'Found' ? loaderData.page.invoice : null;
    return {
      meta: [
        {
          title: invoice
            ? `${invoice.language === 'es' ? 'Factura' : 'Invoice'} ${invoice.number} · ${invoice.issuer}`
            : 'Your invoices · Hadronomy',
        },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  component: function AccountInvoice() {
    const found = Route.useLoaderData();
    if (found._tag !== 'Found') return <MissingInvoicePage />;
    return (
      <PaymentPage
        access={{ _tag: 'Account', id: found.id }}
        page={found.page}
        publishableKey={found.publishableKey}
        account="signed-in"
      />
    );
  },
});

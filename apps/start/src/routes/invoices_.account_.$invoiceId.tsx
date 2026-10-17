import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { MissingInvoicePage } from '~/features/account/account';
import { getAccountInvoice } from '~/features/account/api';
import { PaymentPage } from '~/features/invoices/pay';

export const Route = createFileRoute('/invoices_/account_/$invoiceId')({
  loader: async ({ params }) => {
    const found = await getAccountInvoice({ data: { id: params.invoiceId } });
    // Signed out, the invoice is one sign-in away; the list asks for it.
    if (found._tag === 'SignedOut') throw redirect({ to: '/invoices/account' });
    return found;
  },
  head: ({ loaderData }) => {
    const title =
      loaderData?._tag === 'Found'
        ? translate(loaderData.page.invoice.language)(m.pay_title, {
            number: loaderData.page.invoice.number,
            issuer: loaderData.page.invoice.issuer,
          })
        : loaderData?._tag === 'Missing'
          ? translate(loaderData.language)(m.account_missing)
          : '';
    return {
      meta: [
        { title },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  component: function AccountInvoice() {
    const found = Route.useLoaderData();
    if (found._tag !== 'Found')
      return <MissingInvoicePage language={found.language} />;
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

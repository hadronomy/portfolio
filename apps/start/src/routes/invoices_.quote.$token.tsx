import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { createFileRoute } from '@tanstack/react-router';
import { getQuotePage } from '~/features/invoices/api';
import {
  InvalidQuoteLinkPage,
  QuotePage,
} from '~/features/invoices/quote-page';

import { InvoiceError } from '~/routes/-invoice-error';
import { invoiceRouteError } from '~/routes/-invoice-errors';

export const Route = createFileRoute('/invoices_/quote/$token')({
  onError: invoiceRouteError,
  errorComponent: InvoiceError,
  loader: ({ params }) => getQuotePage({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const title = !loaderData
      ? ''
      : loaderData._tag === 'Open'
        ? translate(loaderData.quote.data.language)(m.quote_title, {
            number: loaderData.quote.number ?? '',
            issuer: loaderData.quote.data.issuer.name,
          })
        : translate(loaderData.language)(m.quote_invalid);
    return {
      meta: [
        { title },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  component: function Quote() {
    const data = Route.useLoaderData();
    const { token } = Route.useParams();
    return data._tag === 'Open' ? (
      <QuotePage token={token} {...data} />
    ) : (
      <InvalidQuoteLinkPage language={data.language} />
    );
  },
});

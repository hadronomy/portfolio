import { createFileRoute } from '@tanstack/react-router';
import { getQuotePage } from '../features/invoices/api';
import {
  InvalidQuoteLinkPage,
  QuotePage,
} from '../features/invoices/quote-page';

export const Route = createFileRoute('/invoices_/quote/$token')({
  loader: ({ params }) => getQuotePage({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const quote = loaderData?.quote;
    return {
      meta: [
        {
          title: quote
            ? `${quote.data.language === 'es' ? 'Presupuesto' : 'Quote'} ${quote.number} · ${quote.data.issuer.name}`
            : 'Quote',
        },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  component: function Quote() {
    const data = Route.useLoaderData();
    const { token } = Route.useParams();
    return data ? (
      <QuotePage token={token} {...data} />
    ) : (
      <InvalidQuoteLinkPage />
    );
  },
});

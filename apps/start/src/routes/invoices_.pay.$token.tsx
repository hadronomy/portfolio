import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { getCheckout } from '../features/invoices/api';
import { InvalidLinkPage, PaymentPage } from '../features/invoices/pay';

function CheckoutError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="iv-pay">
      <main className="iv-pay-ticket" data-plain>
        <article className="iv-pay-doc">
          <div className="iv-pay-gone" role="alert">
            <h1>Payment is unavailable right now</h1>
            <p>
              {error instanceof Error && error.message
                ? error.message
                : 'Try again in a moment.'}
            </p>
            <button
              type="button"
              className="iv-btn"
              data-variant="secondary"
              onClick={() => reset()}
            >
              <span>Try again</span>
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/invoices_/pay/$token')({
  loader: ({ params }) => getCheckout({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const invoice = loaderData?.page.invoice;
    return {
      meta: [
        {
          title: invoice
            ? `${invoice.language === 'es' ? 'Factura' : 'Invoice'} ${invoice.number} · ${invoice.issuer}`
            : 'Payment link',
        },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  errorComponent: CheckoutError,
  component: function Checkout() {
    const data = Route.useLoaderData();
    const { token } = Route.useParams();
    return data ? (
      <PaymentPage
        access={{ _tag: 'Link', token }}
        page={data.page}
        publishableKey={data.publishableKey}
        account={data.account}
      />
    ) : (
      <InvalidLinkPage />
    );
  },
});

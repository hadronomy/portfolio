import { baseLocale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { getCheckout } from '~/features/invoices/api';
import { InvalidLinkPage, PaymentPage } from '~/features/invoices/pay';
import { InvoiceError } from '~/routes/-invoice-error';
import { invoiceRouteError } from '~/routes/-invoice-errors';

// The page failed before it knew the invoice, so it cannot know its
// language either: it says so in Spanish, as every unsure page does.
function CheckoutError(props: ErrorComponentProps) {
  const { reset } = props;
  if (import.meta.env.PROD) return <InvoiceError {...props} />;
  const t = translate(baseLocale);
  return (
    <div className="iv-pay" lang={baseLocale}>
      <main className="iv-pay-ticket" data-plain>
        <article className="iv-pay-doc">
          <div className="iv-pay-gone" role="alert">
            <h1>{t(m.pay_unavailable)}</h1>
            <p>{t(m.pay_unavailable_detail)}</p>
            <button
              type="button"
              className="iv-btn"
              data-variant="secondary"
              onClick={() => reset()}
            >
              <span>{t(m.pay_try_again)}</span>
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
    const title = !loaderData
      ? ''
      : loaderData._tag === 'Open'
        ? translate(loaderData.page.invoice.language)(m.pay_title, {
            number: loaderData.page.invoice.number,
            issuer: loaderData.page.invoice.issuer,
          })
        : translate(loaderData.language)(m.pay_invalid);
    return {
      meta: [
        { title },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'theme-color', content: '#f6f6f5' },
      ],
    };
  },
  onError: invoiceRouteError,
  errorComponent: CheckoutError,
  component: function Checkout() {
    const data = Route.useLoaderData();
    const { token } = Route.useParams();
    return data._tag === 'Open' ? (
      <PaymentPage
        access={{ _tag: 'Link', token }}
        page={data.page}
        publishableKey={data.publishableKey}
        account={data.account}
      />
    ) : (
      <InvalidLinkPage language={data.language} />
    );
  },
});

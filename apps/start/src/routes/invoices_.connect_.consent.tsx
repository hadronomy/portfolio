import { createFileRoute } from '@tanstack/react-router';
import { ConnectConsent } from '~/features/agent/connect';
import { getViewer } from '~/features/invoices/api';

export const Route = createFileRoute('/invoices_/connect_/consent')({
  loader: () => getViewer(),
  head: () => ({
    meta: [
      { title: 'Allow an agent · Invoices' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => (
    <ConnectConsent owner={Route.useLoaderData()?._tag === 'Owner'} />
  ),
});

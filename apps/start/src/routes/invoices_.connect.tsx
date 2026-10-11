import { createFileRoute } from '@tanstack/react-router';
import { ConnectSignIn } from '../features/agent/connect';
import { getViewer } from '../features/invoices/api';

export const Route = createFileRoute('/invoices_/connect')({
  loader: () => getViewer(),
  head: () => ({
    meta: [
      { title: 'Connect an agent · Invoices' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => (
    <ConnectSignIn signedIn={Route.useLoaderData()?._tag === 'Owner'} />
  ),
});

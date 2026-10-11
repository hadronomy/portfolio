import { createFileRoute, redirect } from '@tanstack/react-router';
import { AccountScreen } from '../features/account/account';
import { getAccountPage } from '../features/account/api';

export const Route = createFileRoute('/invoices_/account')({
  loader: async () => {
    const page = await getAccountPage();
    // The owner's invoices are the workspace.
    if (page._tag === 'Owner') throw redirect({ to: '/invoices' });
    return page;
  },
  head: () => ({
    meta: [
      { title: 'Your invoices · Hadronomy' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'theme-color', content: '#f6f6f5' },
    ],
  }),
  component: function Account() {
    return <AccountScreen page={Route.useLoaderData()} />;
  },
});

import { isLocale, translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import { createFileRoute } from '@tanstack/react-router';
import { getPrivacyNotice } from '~/features/privacy/api';
import { PrivacyPage } from '~/features/privacy/privacy-page';

export const Route = createFileRoute('/invoices_/privacy')({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: isLocale(search.lang) ? search.lang : undefined,
  }),
  loaderDeps: ({ search }) => ({ language: search.lang }),
  loader: ({ deps }) =>
    getPrivacyNotice({
      data: deps.language ? { language: deps.language } : {},
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: translate(loaderData?.language ?? 'es')(m.privacy_title) },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'theme-color', content: '#f6f6f5' },
    ],
  }),
  component: function Privacy() {
    return <PrivacyPage {...Route.useLoaderData()} />;
  },
});

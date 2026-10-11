import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '~/consts';
import { profile, socials } from '~/lib/profile';

export type StructuredData = Record<string, unknown>;
export type Breadcrumb = { name: string; path: string };

export function pageUrl(path: string): string {
  const url = new URL(path, SITE_URL);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/') && !/\.[^/]+$/.test(url.pathname)) {
    url.pathname += '/';
  }
  return url.href;
}

export const person = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: profile.name,
  alternateName: 'hadronomy',
  url: pageUrl('/'),
  image: profile.avatar,
  jobTitle: profile.role,
  description: profile.intro,
  sameAs: socials.map(({ href }) => href),
};

export const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: pageUrl('/'),
  name: SITE_NAME,
  alternateName: 'Hadronomy',
  description: SITE_DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': person['@id'] },
};

export function breadcrumbData(items: readonly Breadcrumb[]): StructuredData {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: pageUrl(path),
    })),
  };
}

/** Escape HTML delimiters because JSON-LD lives inside a script element. */
export function serializeStructuredData(
  nodes: readonly StructuredData[],
): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

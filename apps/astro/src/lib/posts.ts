import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * Drafts are readable while `astro dev` runs and absent from anything the build
 * emits — pages, RSS and the sitemap alike. Everything that lists posts goes
 * through here so a draft can never leak out of one of them.
 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection(
    'blog',
    ({ data }) => import.meta.env.DEV || data.state === 'published',
  );

  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

/** Core shows whole minutes; 200 wpm is the usual reading-speed assumption. */
export function readingMinutes(body: string | undefined): number {
  return Math.max(1, Math.round(wordCount(body) / 200));
}

export function wordCount(body: string | undefined): number {
  const text = body?.trim();
  return text ? text.split(/\s+/).length : 0;
}

/** The list format Core uses for writing rows: 11/01/25. */
export const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

/** The article format Core uses above a post title: JAN 1, 2025. */
export const longDate = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

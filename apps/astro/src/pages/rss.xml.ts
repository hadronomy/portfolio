import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '~/consts';
import { getPosts } from '~/lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: SITE_TITLE,
    stylesheet: '/rss/styles.xsl',
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  });
}

import { generateRssFeed } from '~/lib/utils';

export async function GET() {
  const feed = await generateRssFeed();
  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}

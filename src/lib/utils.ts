import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { allPosts } from 'contentlayer/generated';
import { Feed, type FeedOptions } from 'feed';
import { parseISO } from 'date-fns';

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBaseUrl() {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function generateRssFeed() {
  const posts = allPosts.filter(({ published }) => {
    return process.env.NODE_ENV !== 'production' || published;
  });
  const siteUrl = getBaseUrl();
  const feedOptions = {
    title: 'Pablo Hernández | Blog',
    description: 'Welcome to this blog posts!',
    id: siteUrl,
    link: siteUrl,
    image: `${siteUrl}/logo.png`,
    favicon: `${siteUrl}/favicon.png`,
    copyright: `All rights reserved ${new Date().getFullYear()}, Pablo Hernández Jiménez`,
    generator: 'Feed for Node.js',
    feedLinks: {
      rss2: `${siteUrl}/rss.xml`
    }
  } satisfies FeedOptions;
  const feed = new Feed(feedOptions);
  posts.forEach((post) => {
    feed.addItem({
      title: post.title,
      id: `${siteUrl}/blog${post.slug}`,
      link: `${siteUrl}/blog${post.slug}`,
      description: post.description,
      date: parseISO(post.date)
    });
  });
  return feed;
}

export function getLanguageOfFile(filePath: string) {
  const extensionDotIndex = filePath.lastIndexOf('.');
  const extension = filePath.slice(extensionDotIndex + 1);

  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'vue':
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    default:
      return 'javascript';
  }
}

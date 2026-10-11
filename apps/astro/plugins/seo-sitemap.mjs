import { readFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';

/** Read final metadata so noindex pages and article dates stay in sync with HTML. */
export function seoSitemap() {
  let outputDirectory;
  const integration = sitemap({
    async serialize(item) {
      const pathname = new URL(item.url).pathname;
      const html = await readFile(
        new URL(`.${pathname}index.html`, outputDirectory),
        'utf8',
      );
      if (/<meta\s+name="robots"\s+content="[^"]*\bnoindex\b/.test(html))
        return undefined;
      const modified = html.match(
        /<meta\s+property="article:modified_time"\s+content="([^"]+)"/,
      );
      const published = html.match(
        /<meta\s+property="article:published_time"\s+content="([^"]+)"/,
      );
      const lastmod = modified?.[1] ?? published?.[1];
      return lastmod ? { ...item, lastmod } : item;
    },
  });
  const buildDone = integration.hooks['astro:build:done'];
  integration.hooks['astro:build:done'] = async (context) => {
    outputDirectory = context.dir;
    await buildDone(context);
  };
  return integration;
}

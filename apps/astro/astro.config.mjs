import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
// import { transformerTwoslash } from 'fumadocs-twoslash';
import remarkGemoji from 'remark-gemoji';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  integrations: [
    mdx({
      shikiConfig: {
        themes: {
          light: 'catppuccin-latte',
          dark: 'catppuccin-mocha',
        },
        // transformers: [transformerTwoslash()],
      },
      remarkPlugins: [remarkGemoji],
      rehypePlugins: [rehypeAccessibleEmojis],
    }),
    sitemap(),
    tailwind(),
    icon(),
    react(),
  ],
  vite: {
    ssr: {
      noExternal: ['fumadocs-ui'],
    },
  },
});

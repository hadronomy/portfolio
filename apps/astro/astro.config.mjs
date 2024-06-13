import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
// import { transformerTwoslash } from 'fumadocs-twoslash';
import remarkGemoji from 'remark-gemoji';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  markdown: {
    remarkPlugins: [remarkGemoji],
    rehypePlugins: [rehypeAccessibleEmojis],
  },
  integrations: [
    expressiveCode({
      plugins: [pluginLineNumbers()],
      themes: ['catppuccin-mocha', 'catppuccin-latte'],
      defaultProps: {
        showLineNumbers: false,
      },
    }),
    mdx(),
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

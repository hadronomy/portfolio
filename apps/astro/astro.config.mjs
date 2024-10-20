import path from 'node:path';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import preserveDirectives from 'rollup-preserve-directives';

import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { imageService } from '@unpic/astro/service';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
// import { transformerTwoslash } from 'fumadocs-twoslash';
import remarkGemoji from 'remark-gemoji';

import { remarkReadingTime } from './plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  image: imageService({
    placeholder: 'blurhash',
    layout: 'constrained',
  }),
  markdown: {
    remarkPlugins: [remarkGemoji, remarkReadingTime],
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
    tailwind({
      applyBaseStyles: false,
    }),
    icon({
      include: {
        tabler: ['*'],
      },
    }),
    react(),
  ],
  vite: {
    plugins: [preserveDirectives()],
    ssr: {
      noExternal: ['fumadocs-ui'],
    },
    resolve: {
      alias: {
        '@portfolio/ui': path.resolve(
          import.meta.dirname,
          '../../packages/ui/src',
        ),
      },
    },
  },
});

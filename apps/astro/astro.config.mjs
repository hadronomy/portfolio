import path from 'node:path';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import preserveDirectives from 'rollup-preserve-directives';

import icon from 'astro-icon';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import remarkGemoji from 'remark-gemoji';

import { rehypeCode } from 'fumadocs-core/mdx-plugins';

import { remarkReadingTime } from './plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  markdown: {
    syntaxHighlight: false,
    remarkPlugins: [remarkGemoji, remarkReadingTime],
    rehypePlugins: [
      rehypeAccessibleEmojis,
      [
        rehypeCode,
        {
          themes: {
            light: 'catppuccin-latte',
            dark: 'catppuccin-mocha',
          },
        },
      ],
    ],
  },
  integrations: [
    mdx(),
    sitemap(),
    icon({
      include: {
        tabler: ['*'],
      },
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss(), preserveDirectives()],
    ssr: {
      noExternal: ['fumadocs-ui'],
    },
    // css: {
    //   transformer: 'lightningcss',
    // },
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

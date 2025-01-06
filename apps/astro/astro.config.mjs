import path from 'node:path';

import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import preserveDirectives from 'rollup-preserve-directives';

import { imageService } from '@unpic/astro/service';
import icon from 'astro-icon';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import remarkGemoji from 'remark-gemoji';

import { rehypeCode } from 'fumadocs-core/mdx-plugins';

import { remarkReadingTime } from './plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  image: {
    service: imageService({
      placeholder: 'blurhash',
      layout: 'constrained',
      cdnOptions: {
        vercel: {
          domain: 'hadronomy.com',
        },
      },
      fallbackService: 'astro',
    }),
  },
  markdown: {
    syntaxHighlight: false,
    remarkPlugins: [remarkGemoji, remarkReadingTime],
    rehypePlugins: [
      rehypeAccessibleEmojis,
      [
        rehypeCode,
        {
          themes: {
            light: 'catppuccin-frappe',
            dark: 'catppuccin-mocha',
          },
        },
      ],
    ],
  },
  integrations: [
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

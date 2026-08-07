import path from 'node:path';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import icon from 'astro-icon';
import { rehypeCode } from 'fumadocs-core/mdx-plugins';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeKatex from 'rehype-katex';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import preserveDirectives from 'rollup-preserve-directives';

import { remarkReadingTime } from './plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://hadronomy.com',
  markdown: {
    syntaxHighlight: false,
    remarkPlugins: [remarkGemoji, remarkReadingTime, remarkMath],
    rehypePlugins: [
      rehypeAccessibleEmojis,
      rehypeKatex,
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
  env: {
    schema: {
      GITHUB_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      CERTIFICATE_P12: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CERTIFICATE_PASSWORD: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  integrations: [
    mdx(),
    sitemap(),
    icon({
      include: {
        tabler: ['*'],
        icons: ['*'],
        'simple-icons': ['*'],
        octicon: ['*'],
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
      // Motion pulls React in through its own pre-bundled copy in dev, which
      // hands an island a second React and breaks every hook it calls.
      dedupe: ['react', 'react-dom'],
      alias: {
        '@portfolio/ui': path.resolve(
          import.meta.dirname,
          '../../packages/ui/src',
        ),
      },
    },
  },
});

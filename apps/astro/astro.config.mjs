import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { rendererRich, transformerTwoslash } from '@shikijs/twoslash';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import icon from 'astro-icon';
import {
  rehypeCode,
  rehypeCodeDefaultOptions,
} from 'fumadocs-core/mdx-plugins';
import { rehypeAccessibleEmojis } from 'rehype-accessible-emojis';
import rehypeKatex from 'rehype-katex';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import preserveDirectives from 'rollup-preserve-directives';

import { rehypeMarkCodeBlocks } from './plugins/rehype-mark-code-blocks.mjs';

export default defineConfig({
  site: 'https://hadronomy.com',
  markdown: {
    syntaxHighlight: false,
    remarkPlugins: [remarkGemoji, remarkMath],
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
          // fumadocs ships a per-language logo for its own React code block to
          // consume. Nothing renders it here, and the palette is achromatic, so
          // a brand-coloured mark would be the only hue on the page.
          icon: false,
          // Passing this key replaces fumadocs' defaults rather than extending
          // them, so the notation transformers are re-listed here.
          transformers: [
            ...rehypeCodeDefaultOptions.transformers,
            // Only blocks tagged ```ts twoslash pay the type-checking cost.
            transformerTwoslash({
              explicitTrigger: true,
              // A `^?` query is meant to be read without hovering. The default
              // renders it as a floating card injected mid-line, which splits
              // the code around it; `line` gives it a row of its own.
              renderer: rendererRich({ queryRendering: 'line' }),
            }),
          ],
        },
      ],
      rehypeMarkCodeBlocks,
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
    // No `include`: astro-icon loads every installed `@iconify-json/*` pack
    // whole unless a collection names a subset, so the dependency list is
    // already the set of collections. Listing them here as `['*']` restates it
    // and goes stale the moment one is added.
    icon(),
    react(),
  ],
  vite: {
    plugins: [tailwindcss(), preserveDirectives()],
    ssr: {
      noExternal: ['fumadocs-ui'],
    },
    resolve: {
      // Motion pulls React in through its own pre-bundled copy in dev, which
      // hands an island a second React and breaks every hook it calls.
      dedupe: ['react', 'react-dom'],
    },
  },
});

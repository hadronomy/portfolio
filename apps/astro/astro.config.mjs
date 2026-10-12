import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { rendererRich, transformerTwoslash } from '@shikijs/twoslash';
import tailwindcss from '@tailwindcss/vite';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';
import { defineConfig } from 'astro/config';
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
import startIntegration from './integrations/start.mjs';

import { rehypeMarkCodeBlocks } from './plugins/rehype-mark-code-blocks.mjs';
import { seoSitemap } from './plugins/seo-sitemap.mjs';
import { SITE_URL } from './src/consts';
import { defaultLocale, locales } from './src/i18n/locales';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale,
    locales: [...locales],
    routing: { prefixDefaultLocale: false },
  },
  // Every POST this site serves is the Start app's, and it checks origins
  // itself: server functions refuse cross-origin calls and sign-in has its
  // own CSRF checks. Astro's check would also refuse the form-encoded token
  // requests agents send to sign in, which carry no Origin.
  security: { checkOrigin: false },
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  markdown: {
    syntaxHighlight: false,
    processor: unified({
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
    }),
  },
  integrations: [
    startIntegration(),
    // MDX probes components by calling them. Let React claim components with hooks first.
    react(),
    mdx(),
    seoSitemap(),
    // No `include`: astro-icon loads every installed `@iconify-json/*` pack
    // whole unless a collection names a subset, so the dependency list is
    // already the set of collections. Listing them here as `['*']` restates it
    // and goes stale the moment one is added.
    icon(),
  ],
  vite: {
    // Shader covers resolve their WGSL imports before vgpu loads them.
    plugins: [
      tailwindcss(),
      preserveDirectives(),
      wgslVitePlugin({ minify: true }),
    ],
    optimizeDeps: { exclude: ['takumi-pdf', 'takumi-js'] },
    ssr: {
      // Start and the CV renderer load these modules at runtime, so this
      // package declares them as dependencies as well as SSR externals.
      external: [
        'takumi-pdf',
        'takumi-js',
        '@electric-sql/pglite',
        'pg',
        '@atproto/oauth-client-node',
        '@embedpdf/engines',
        '@embedpdf/pdfium',
        'sharp',
      ],
      noExternal: ['fumadocs-ui'],
    },
    resolve: {
      // Motion pulls React in through its own pre-bundled copy in dev, which
      // hands an island a second React and breaks every hook it calls.
      dedupe: ['react', 'react-dom'],
    },
  },
});

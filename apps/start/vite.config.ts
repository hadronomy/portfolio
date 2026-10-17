import { fileURLToPath } from 'node:url';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Keep in sync with apps/astro/astro.config.mjs: native-only modules the
  // server runtime must not bundle. The build resolves them from this
  // package, so each is also one of its dependencies.
  ssr: {
    external: [
      'takumi-pdf',
      '@electric-sql/pglite',
      'pg',
      '@atproto/oauth-client-node',
      '@embedpdf/engines',
      '@embedpdf/pdfium',
      'sharp',
    ],
  },
  base: '/_apps/',
  // Two lazy chunks pass Vite's 500 kB default, and both earn it: the PDFium
  // worker the PDF preview runs, and TipTap, which only the quote page, the
  // editor and the preview load. The entry stays near 400 kB, so a heavy
  // module that leaks into it still trips this limit.
  build: { chunkSizeWarningLimit: 700 },
  // `~/` is declared once, in tsconfig.json, and every module of the app
  // imports another through it: no path climbs out of its folder.
  resolve: { tsconfigPaths: true },
  plugins: [
    // Recompiles the messages as they are edited; the i18n package's own
    // build does the same outside Vite. Both read project.inlang.
    paraglideVitePlugin({
      project: fileURLToPath(
        new URL('../../packages/i18n/project.inlang', import.meta.url),
      ),
      outdir: fileURLToPath(
        new URL('../../packages/i18n/src/paraglide', import.meta.url),
      ),
      emitTsDeclarations: true,
    }),
    tanstackStart({
      router: {
        basepath: '/',
        tmpDir: fileURLToPath(new URL('./.tanstack/tmp', import.meta.url)),
      },
      serverFns: { base: '/_apps/functions' },
    }),
    react(),
    tailwindcss(),
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});

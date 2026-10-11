import { fileURLToPath } from 'node:url';
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
  // The `@/` alias is shadcn's: the bklit charts in src/components import
  // each other through it.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
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

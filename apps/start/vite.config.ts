import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Keep in sync with apps/astro/astro.config.mjs: native-only modules the
  // server runtime must not bundle.
  ssr: {
    external: [
      'takumi-pdf',
      '@electric-sql/pglite',
      'pg',
      '@atproto/oauth-client-node',
    ],
  },
  base: '/_apps/',
  plugins: [
    tanstackStart({
      router: {
        basepath: '/',
        tmpDir: fileURLToPath(new URL('./.tanstack/tmp', import.meta.url)),
      },
      serverFns: { base: '/_apps/functions' },
    }),
    react(),
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});

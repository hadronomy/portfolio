import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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

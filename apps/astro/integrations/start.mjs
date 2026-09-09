import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const startRoot = new URL('../../start/', import.meta.url);
const endpoint = new URL('./start-endpoint.ts', import.meta.url);
const routeFile = new URL('src/astro-routes.gen.json', startRoot);
const startRequire = createRequire(new URL('package.json', startRoot));
const handlerId = 'virtual:portfolio/start';
const internalHandlerId = `\0${handlerId}`;

export default function startIntegration() {
  let command;
  let clientDirectory;
  let startServer;
  let startOrigin;
  const startReady = Promise.withResolvers();
  let astroPatterns = [];
  return {
    name: 'portfolio:start',
    hooks: {
      'astro:config:setup': ({
        injectRoute,
        updateConfig,
        command: current,
      }) => {
        command = current;
        injectRoute({
          pattern: '/[...start]',
          entrypoint: endpoint,
          prerender: false,
        });
        updateConfig({
          vite: {
            server: {
              proxy: {
                '/_apps/': {
                  target: 'http://127.0.0.1:0',
                  changeOrigin: false,
                  ws: true,
                  configure(proxy, options) {
                    options.target = startOrigin;
                    proxy.options.target = startOrigin;
                  },
                  bypass(request) {
                    const pathname = decodeURI(
                      new URL(request.url, 'http://localhost').pathname,
                    );
                    if (astroPatterns.some((pattern) => pattern.test(pathname)))
                      return request.url;
                  },
                },
              },
            },
            plugins: [
              {
                name: 'portfolio:start-handler',
                resolveId(id) {
                  if (id === handlerId) return internalHandlerId;
                },
                async load(id) {
                  if (id !== internalHandlerId) return;
                  if (command === 'dev') {
                    const origin = await startReady.promise;
                    return `export default { fetch(request) {
                const url = new URL(request.url);
                const target = new URL(url.pathname + url.search, ${JSON.stringify(origin)});
                const headers = new Headers(request.headers);
                headers.set('host', url.host);
                return fetch(target, { method: request.method, headers,
                  body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
                  duplex: 'half', redirect: 'manual', signal: request.signal });
              } };`;
                  }
                  return `export { default } from ${JSON.stringify(fileURLToPath(new URL('dist/server/server.js', startRoot)))};`;
                },
              },
            ],
          },
        });
      },
      'astro:config:done': ({ config }) => {
        clientDirectory = config.build.client;
      },
      'astro:routes:resolved': async ({ routes }) => {
        const patterns = routes
          .filter((route) => route.pattern !== '/[...start]')
          .map((route) => ({
            source: route.patternRegex.source,
            flags: route.patternRegex.flags,
          }));
        astroPatterns = patterns.map(
          ({ source, flags }) => new RegExp(source, flags),
        );
        const json = `${JSON.stringify(patterns, null, 2)}\n`;
        let previous;
        try {
          previous = await readFile(routeFile, 'utf8');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        if (previous !== json) await writeFile(routeFile, json);
      },
      'astro:server:setup': async ({ logger, server }) => {
        const { createServer } = await import(
          pathToFileURL(startRequire.resolve('vite')).href
        );
        startServer = await createServer({
          root: fileURLToPath(startRoot),
          server: {
            host: '127.0.0.1',
            port: 0,
            strictPort: true,
            allowedHosts: server.config.server.allowedHosts,
          },
        });
        try {
          await startServer.listen();
          const { port } = startServer.httpServer.address();
          startOrigin = `http://127.0.0.1:${port}`;
          startReady.resolve(startOrigin);
          logger.info('Start routes ready');
        } catch (error) {
          await startServer.close();
          throw error;
        }
      },
      'astro:server:done': async () => {
        await startServer?.close();
      },
      'astro:build:start': async () => {
        const viteBin = fileURLToPath(
          new URL('./node_modules/vite/bin/vite.js', startRoot),
        );
        await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [viteBin, 'build'], {
            cwd: startRoot,
            stdio: 'inherit',
          });
          child.once('error', reject);
          child.once('exit', (code, signal) =>
            code === 0
              ? resolve()
              : reject(new Error(`Start build failed (${signal ?? code}).`)),
          );
        });
      },
      'astro:build:done': async () => {
        const target = new URL('_apps/', clientDirectory);
        await mkdir(target, { recursive: true });
        await cp(new URL('dist/client/', startRoot), target, {
          recursive: true,
        });
      },
    },
  };
}

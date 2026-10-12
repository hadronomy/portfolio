import { readFile, writeFile } from 'node:fs/promises';
import vercel from '@astrojs/vercel';

export function portfolioSlashRoutes(pages) {
  return pages.flatMap(({ pathname }) => {
    const path = `/${pathname.replace(/^\/+|\/+$/g, '')}`;
    if (
      path === '/' ||
      /\.[^/]+$/.test(path) ||
      /^\/(?:invoices|_apps|\.well-known)(?:\/|$)/.test(path)
    )
      return [];
    return [
      {
        src: `^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        headers: { Location: `${path}/` },
        status: 308,
      },
    ];
  });
}

export default function portfolioVercel() {
  const adapter = vercel();
  let output;
  const configDone = adapter.hooks['astro:config:done'];
  adapter.hooks['astro:config:done'] = async (context) => {
    output = new URL('.vercel/output/config.json', context.config.root);
    await configDone(context);
  };
  const buildDone = adapter.hooks['astro:build:done'];
  adapter.hooks['astro:build:done'] = async (context) => {
    await buildDone(context);
    const config = JSON.parse(await readFile(output, 'utf8'));
    // Static portfolio pages need canonical slashes. Start receives its URLs unchanged.
    config.routes.unshift(...portfolioSlashRoutes(context.pages));
    await writeFile(output, `${JSON.stringify(config, null, 2)}\n`);
  };
  return adapter;
}

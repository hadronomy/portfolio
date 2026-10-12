import { expect, test } from 'vitest';
import { portfolioSlashRoutes } from '../integrations/vercel.mjs';

const pages = [
  '/',
  '/blog/',
  '/blog/a-post',
  '/work/inari',
  '/experiments/',
  '/cv.pdf',
  '/invoices',
  '/invoices/mcp',
  '/invoices/auth/token',
  '/invoices/auth/atproto/client-metadata.json',
  '/_apps/functions/example',
  '/.well-known/oauth-authorization-server/invoices/auth',
  '/.well-known/oauth-protected-resource/invoices/mcp',
].map((pathname) => ({ pathname }));
const routes = portfolioSlashRoutes(pages);

for (const path of ['/blog', '/blog/a-post', '/work/inari', '/experiments']) {
  test(`${path} redirects to its canonical portfolio URL`, () => {
    const route = routes.find(({ src }) => new RegExp(src).test(path));
    expect(route?.status).toBe(308);
    expect(route?.headers.Location).toBe(`${path}/`);
  });
}

for (const { pathname } of pages) {
  if (
    ['/blog/', '/blog/a-post', '/work/inari', '/experiments/'].includes(
      pathname,
    )
  )
    continue;
  test(`${pathname} bypasses slash redirects for every request method`, () => {
    expect(routes.some(({ src }) => new RegExp(src).test(pathname))).toBe(
      false,
    );
  });
}

test('canonical portfolio URLs do not redirect again', () => {
  for (const path of [
    '/blog/',
    '/blog/a-post/',
    '/work/inari/',
    '/experiments/',
  ]) {
    expect(routes.some(({ src }) => new RegExp(src).test(path))).toBe(false);
  }
});

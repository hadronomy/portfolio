import { readFileSync } from 'node:fs';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { expect, test } from 'vitest';

const configuration = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
);
const { routes, error } = getTransformedRoutes(configuration);

function redirectFor(path, method, host = 'hadronomy.com') {
  const route = routes.find(
    ({ src, status, headers, methods, has = [] }) =>
      status >= 300 &&
      status < 400 &&
      headers?.Location &&
      new RegExp(src).test(path) &&
      (!methods || methods.includes(method)) &&
      has.every(
        (condition) => condition.type === 'host' && condition.value === host,
      ),
  );
  if (!route) return undefined;
  return {
    status: route.status,
    location: path.replace(new RegExp(route.src), route.headers.Location),
  };
}

test('Vercel accepts the deployment routing configuration', () => {
  expect(error).toBeNull();
});

const portfolioPaths = [
  '/blog',
  '/blog/a-post',
  '/experiments',
  '/experiments/text',
  '/work/inari',
  '/work/vrpt-swts',
  '/es/blog',
  '/archive.v1/post',
  '/invoices-preview',
  '/_apps-preview',
  '/.well-known-preview/page',
  // An unknown path can redirect to its slashed URL before its 404 response.
  '/nope',
];
const protectedPaths = [
  ...['/invoices', '/_apps', '/.well-known'].flatMap((prefix) => [
    prefix,
    `${prefix}/`,
    `${prefix}/child`,
    `${prefix}/child/`,
    `${prefix}/child/deep`,
    `${prefix}/file.json`,
  ]),
  '/invoices/mcp',
  '/invoices/auth/token',
  '/invoices/auth/oauth2/token',
  '/invoices/auth/atproto/callback',
  '/invoices/auth/atproto/client-metadata.json',
  '/_apps/functions/example',
  '/.well-known/oauth-authorization-server/invoices/auth',
  '/.well-known/oauth-protected-resource/invoices/mcp',
];
const unchangedPaths = [
  '/',
  '/cv.pdf',
  '/rss.xml',
  '/_astro/x.js',
  '/favicon.ico',
  '/work/project.json',
  ...portfolioPaths.map((path) => `${path}/`),
  ...protectedPaths,
];

for (const method of ['GET', 'POST']) {
  for (const path of portfolioPaths) {
    test(`${method} ${path} receives a portfolio slash redirect`, () => {
      expect(redirectFor(path, method)).toEqual({
        status: 308,
        location: `${path}/`,
      });
    });
  }

  for (const path of unchangedPaths) {
    test(`${method} ${path} bypasses redirects on the apex host`, () => {
      expect(redirectFor(path, method)).toBeUndefined();
    });
  }

  for (const path of [...portfolioPaths, ...unchangedPaths, '/work/stacks/']) {
    test(`${method} www${path} redirects to the apex host`, () => {
      expect(redirectFor(path, method, 'www.hadronomy.com')).toEqual({
        status: 308,
        location: `https://hadronomy.com${path}`,
      });
    });
  }
}

test('the gallery redirect keeps its destination', () => {
  expect(redirectFor('/work/stacks/', 'GET')).toEqual({
    status: 308,
    location: '/#work',
  });
});

// Stripe's fields and mail clients read the font from other origins.
test('the self-hosted font may be read across origins', () => {
  const route = routes.find(
    ({ src, headers }) =>
      new RegExp(src).test('/fonts/geist-latin-wght-normal.woff2') &&
      headers?.['Access-Control-Allow-Origin'],
  );
  expect(route?.headers['Access-Control-Allow-Origin']).toBe('*');
});

import { astroMatcher, routeOwner } from '@portfolio/site-routing';
import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { matchesStartRoute } from '~/matches-route';

const root = createRootRoute();
const store = createRoute({ getParentRoute: () => root, path: 'store' });
const index = createRoute({ getParentRoute: () => store, path: '/' });
const cart = createRoute({ getParentRoute: () => store, path: 'cart' });
const product = createRoute({
  getParentRoute: () => root,
  path: 'products/$id',
});
const files = createRoute({ getParentRoute: () => root, path: 'files/$' });
const blog = createRoute({ getParentRoute: () => root, path: 'blog/tool' });
const router = createRouter({
  routeTree: root.addChildren([
    store.addChildren([index, cart]),
    product,
    files,
    blog,
  ]),
});
const matches = {
  astro: astroMatcher([
    { source: '^/store/?$', flags: '' },
    { source: '^/store/cart/help/?$', flags: '' },
    { source: '^/blog(?:/.*)?$', flags: '' },
  ]),
  start: (path: string) => matchesStartRoute(router, path),
};
test.each([
  ['/store', 'astro'],
  ['/store/cart', 'start'],
  ['/store/missing', 'astro'],
  ['/store/cart/missing', 'start'],
  ['/store/cart/help', 'astro'],
  ['/store/cart/help/missing', 'astro'],
  ['/products/abc', 'start'],
  ['/products/abc/missing', 'start'],
  ['/products', 'astro'],
  ['/files/a/b', 'start'],
  ['/files', 'start'],
  ['/blog/tool', 'astro'],
  ['/blog/missing', 'astro'],
  ['/missing', 'astro'],
] as const)('TanStack tree: %s belongs to %s', (path, owner) =>
  expect(routeOwner(path, matches)).toBe(owner));

test('a fuzzy match does not claim an undeclared parent route', () => {
  expect(matches.start('/store/missing')).toBe(false);
  expect(matches.start('/products')).toBe(false);
  expect(matches.start('/')).toBe(false);
});

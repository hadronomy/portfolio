import { astroMatcher, routeOwner } from '@portfolio/site-routing';
import { expect, test } from 'vitest';

const matches = {
  astro: astroMatcher([
    { source: '^/$', flags: '' },
    { source: '^/store/?$', flags: '' },
    { source: '^/store/cart/help/?$', flags: '' },
    { source: '^/blog(?:/.*)?/?$', flags: '' },
  ]),
  start: (path: string) =>
    ['/store', '/store/cart', '/lab', '/blog/app'].includes(path),
};
test.each([
  ['/store', 'astro'],
  ['/store/', 'astro'],
  ['/store/cart', 'start'],
  ['/store/unknown', 'astro'],
  ['/store/cart/unknown', 'start'],
  ['/store/cart/help', 'astro'],
  ['/store/cart/help/unknown', 'astro'],
  ['/lab/unknown/deep', 'start'],
  ['/laboratory/unknown', 'astro'],
  ['/unknown', 'astro'],
  ['/', 'astro'],
  ['/blog/app', 'astro'],
  ['/blog/unknown', 'astro'],
  ['/store//cart/', 'start'],
] as const)('%s belongs to %s', (path, owner) =>
  expect(routeOwner(path, matches)).toBe(owner));
test('an empty Start tree does not claim the site through its root layout', () => {
  expect(
    routeOwner('/missing', { astro: () => false, start: () => false }),
  ).toBe('astro');
});

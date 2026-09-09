import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astroMatcher, routeOwner } from './index.ts';

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
for (const [path, owner] of [
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
] as const) {
  test(`${path} belongs to ${owner}`, () =>
    assert.equal(routeOwner(path, matches), owner));
}
test('an empty Start tree does not claim the site through its root layout', () => {
  assert.equal(
    routeOwner('/missing', { astro: () => false, start: () => false }),
    'astro',
  );
});

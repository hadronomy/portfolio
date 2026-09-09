export type RouteOwner = 'astro' | 'start';
export interface RouteMatchers {
  astro: (pathname: string) => boolean;
  start: (pathname: string) => boolean;
}

/** Exact route matches take priority; otherwise the nearest route owns the 404. */
export function routeOwner(
  pathname: string,
  matches: RouteMatchers,
): RouteOwner {
  let path = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  for (;;) {
    if (matches.astro(path)) return 'astro';
    if (matches.start(path)) return 'start';
    if (path === '/') return 'astro';
    path = path.slice(0, path.lastIndexOf('/')) || '/';
  }
}

export function astroMatcher(
  patterns: readonly { source: string; flags: string }[],
) {
  const routes = patterns.map(({ source, flags }) => new RegExp(source, flags));
  return (pathname: string) =>
    routes.some((route) => route.test(decodeURI(pathname)));
}

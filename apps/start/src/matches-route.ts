import type { AnyRouter } from '@tanstack/react-router';

export function matchesStartRoute(
  router: AnyRouter,
  pathname: string,
): boolean {
  const [, params, route] = router.getMatchedRoutes(pathname);
  return Boolean(route && route.id !== '__root__' && !params['**']);
}

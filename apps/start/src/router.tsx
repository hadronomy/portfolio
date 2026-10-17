import {
  astroMatcher,
  type RouteOwner,
  routeOwner,
} from '@portfolio/site-routing';
import { type AnyRouter, createRouter } from '@tanstack/react-router';
import astroRoutes from '~/astro-routes.gen.json';
import { matchesStartRoute } from '~/matches-route';
import { routeTree } from '~/routeTree.gen';

export const matchesAstro = astroMatcher(astroRoutes);

export function getRouter() {
  const router = createRouter({
    routeTree,
    context: {
      ownerOf: (pathname: string): RouteOwner =>
        getRouteOwner(router, pathname),
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
  });

  return router;
}

export function getRouteOwner(router: AnyRouter, pathname: string): RouteOwner {
  return routeOwner(pathname, {
    astro: matchesAstro,
    start: (path) => matchesStartRoute(router, path),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

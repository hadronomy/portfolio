import {
  astroMatcher,
  type RouteOwner,
  routeOwner,
} from '@portfolio/site-routing';
import { QueryClient } from '@tanstack/react-query';
import { type AnyRouter, createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import astroRoutes from '~/astro-routes.gen.json';
import { matchesStartRoute } from '~/matches-route';
import { routeTree } from '~/routeTree.gen';

export const matchesAstro = astroMatcher(astroRoutes);

export function getRouter() {
  // One client per request on the server and one per visit in the browser.
  // Loaders fill it before the page renders, and the integration sends what
  // they fetched along with the HTML, so the first paint has the data and
  // the browser does not ask for it again.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  });
  const router = createRouter({
    routeTree,
    context: {
      ownerOf: (pathname: string): RouteOwner =>
        getRouteOwner(router, pathname),
      queryClient,
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Preloading on intent is the query cache's job; the router keeps no
    // second copy that could go stale beside it.
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });

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

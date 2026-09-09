import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { getRouteOwner, getRouter, matchesAstro } from './router';

export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    const router = getRouter();
    const owner = getRouteOwner(router, url.pathname);
    if (
      matchesAstro(url.pathname) ||
      (!url.pathname.startsWith('/_apps/functions/') && owner === 'astro')
    ) {
      return new Response(null, {
        status: 404,
        headers: { 'x-portfolio-route-owner': 'astro' },
      });
    }
    return handler.fetch(request);
  },
});

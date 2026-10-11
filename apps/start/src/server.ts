import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { getRouteOwner, getRouter, matchesAstro } from './router';

/**
 * In development Astro reaches this server through fetch, which replaces the
 * browser's Sec-Fetch-Mode with its own. The proxy carries the original in
 * x-forwarded-fetch-mode; sign-in reads it to tell a page load from a call.
 */
function restoreFetchMode(request: Request) {
  const mode = request.headers.get('x-forwarded-fetch-mode');
  if (!import.meta.env.DEV || !mode) return request;
  const headers = new Headers(request.headers);
  headers.set('sec-fetch-mode', mode);
  headers.delete('x-forwarded-fetch-mode');
  // Rebuilt from its parts: the dev server's request is not a native one.
  const bodiless = request.method === 'GET' || request.method === 'HEAD';
  return new Request(request.url, {
    method: request.method,
    headers,
    signal: request.signal,
    ...(bodiless ? {} : { body: request.body, duplex: 'half' }),
  });
}

export default createServerEntry({
  fetch(incoming) {
    const request = restoreFetchMode(incoming);
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

import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { getRouteOwner, getRouter, matchesAstro } from '~/router';
import {
  clientAddress,
  clientAddressHeader,
} from '~/server/client-address.server';
import { reportedError } from '~/server/errors.server';
import { invoiceHeaders, isInvoiceResponse } from '~/server/headers.server';

/**
 * A copy of the request with its headers edited. Rebuilt from its parts:
 * the dev server's request is not a native one, and `new Request(request)`
 * cannot read its private state.
 */
function withHeaders(request: Request, edit: (headers: Headers) => void) {
  const headers = new Headers(request.headers);
  edit(headers);
  const bodiless = request.method === 'GET' || request.method === 'HEAD';
  return new Request(request.url, {
    method: request.method,
    headers,
    signal: request.signal,
    ...(bodiless ? {} : { body: request.body, duplex: 'half' }),
  });
}

/**
 * In development Astro reaches this server through fetch, which replaces the
 * browser's Sec-Fetch-Mode with its own. The proxy carries the original in
 * x-forwarded-fetch-mode; sign-in reads it to tell a page load from a call.
 */
function restoreFetchMode(request: Request) {
  const mode = request.headers.get('x-forwarded-fetch-mode');
  if (!import.meta.env.DEV || !mode) return request;
  return withHeaders(request, (headers) => {
    headers.set('sec-fetch-mode', mode);
    headers.delete('x-forwarded-fetch-mode');
  });
}

export default createServerEntry({
  async fetch(incoming) {
    const restored = restoreFetchMode(incoming);
    // Astro supplies its socket address as request context. A Node client
    // cannot supply this property through HTTP headers.
    const transport = incoming as Request & {
      context?: { clientAddress?: string };
      ip?: string;
    };
    const ip = clientAddress(
      incoming,
      transport.context?.clientAddress ?? transport.ip,
      process.env.VERCEL === '1',
    );
    const request = withHeaders(restored, (headers) => {
      headers.delete(clientAddressHeader);
      if (ip) headers.set(clientAddressHeader, ip);
    });
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
    try {
      return invoiceHeaders(request, await handler.fetch(request));
    } catch (error) {
      if (!import.meta.env.PROD || !isInvoiceResponse(url.pathname))
        throw error;
      const safe = reportedError(error);
      return invoiceHeaders(
        request,
        new Response(safe.message, {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
      );
    }
  },
});

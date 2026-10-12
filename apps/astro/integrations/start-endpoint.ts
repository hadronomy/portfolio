import start from 'virtual:portfolio/start';
import type { APIRoute } from 'astro';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  // Start's Web Request has no socket. Preserve Astro's transport address
  // as server context, never as a header that a Node client can spoof.
  // Keep Astro's security.allowedDomains empty for the Node adapter. That
  // option also makes clientAddress trust the supplied X-Forwarded-For.
  Object.assign(context.request, {
    context: { clientAddress: context.clientAddress },
  });
  const response = await start.fetch(context.request);
  if (response.headers.get('x-portfolio-route-owner') !== 'astro')
    return response;
  const notFound = await context.rewrite('/404');
  return new Response(notFound.body, {
    status: 404,
    headers: notFound.headers,
  });
};

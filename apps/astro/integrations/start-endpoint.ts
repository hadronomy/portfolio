import start from 'virtual:portfolio/start';
import type { APIRoute } from 'astro';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const response = await start.fetch(context.request);
  if (response.headers.get('x-portfolio-route-owner') !== 'astro')
    return response;
  const notFound = await context.rewrite('/404');
  return new Response(notFound.body, {
    status: 404,
    headers: notFound.headers,
  });
};

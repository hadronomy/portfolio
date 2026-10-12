/** The routes and transports owned by the private invoices application. */
export const isInvoiceResponse = (pathname: string) =>
  pathname === '/invoices' ||
  pathname.startsWith('/invoices/') ||
  pathname.startsWith('/_apps/functions/') ||
  /^\/\.well-known\/(oauth-authorization-server|oauth-protected-resource|openid-configuration)(\/|$)/.test(
    pathname,
  );

// Stripe.js, Link and hCaptcha host their own frames and network calls.
// https://docs.stripe.com/security/guide#content-security-policy
// https://docs.hcaptcha.com/#content-security-policy-settings
// Start streams inline bootstrap scripts. Motion and the editor set inline
// styles. PDFium compiles WASM in a blob worker, without JavaScript eval.
const htmlPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://hcaptcha.com https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' blob: https://api.stripe.com https://js.stripe.com https://*.js.stripe.com https://link.com https://*.link.com https://hcaptcha.com https://*.hcaptcha.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-src 'self' blob: https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com https://hcaptcha.com https://*.hcaptcha.com",
  "worker-src 'self' blob:",
].join('; ');

/** Applies privacy rules after handlers, including refused and failed requests. */
export function invoiceHeaders(request: Request, response: Response): Response {
  const path = new URL(request.url).pathname;
  if (!isInvoiceResponse(path)) return response;
  const headers = new Headers(response.headers);
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  const html = headers.get('content-type')?.includes('text/html');
  headers.set(
    'Content-Security-Policy',
    html ? htmlPolicy : "frame-ancestors 'none'",
  );
  // Revoked customer links must not leave a usable browser or CDN copy.
  headers.set('Cache-Control', 'private, no-store');
  headers.delete('CDN-Cache-Control');
  headers.delete('Vercel-CDN-Cache-Control');
  if (
    /application\/pdf|image\//i.test(headers.get('content-type') ?? '') ||
    /\.pdf$|\/pdf(?:\/|$)|\/pages\//.test(path)
  )
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  // HSTS belongs at the HTTPS ingress: Cloudflare for hadronomy.com and
  // Vercel for deployment domains. Configure it there for static assets too.
  // A plain HTTP Node host must not advertise a transport it does not serve.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

import { describe, expect, it } from 'vitest';
import { invoiceHeaders } from '~/server/headers.server';

const request = (path: string) => new Request(`https://hadronomy.com${path}`);
const secured = (path: string, type = 'text/html', status = 200) =>
  invoiceHeaders(
    request(path),
    new Response(null, {
      status,
      headers: {
        'content-type': type,
        'cache-control': 'private, max-age=31536000',
        'Vercel-CDN-Cache-Control': 'max-age=100',
      },
    }),
  );

describe('invoice response headers', () => {
  it.each([
    '/invoices',
    '/invoices/auth/token',
    '/invoices/mcp',
    '/_apps/functions/example',
    '/.well-known/oauth-protected-resource/invoices/mcp',
    '/.well-known/oauth-authorization-server/invoices/auth',
    '/.well-known/openid-configuration',
  ])('protects %s', (path) => {
    const response = secured(path, 'application/json', 401);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.has('vercel-cdn-cache-control')).toBe(false);
    expect(response.status).toBe(401);
  });
  it.each([
    'application/pdf',
    'image/webp',
  ])('keeps %s out of crawlers and caches', (type) => {
    expect(
      secured('/invoices/quote/token/pdf', type).headers.get('x-robots-tag'),
    ).toBe('noindex, nofollow, noarchive');
  });
  it('allows Stripe, Link, hCaptcha, signature images and PDFium without JavaScript eval', () => {
    const csp = secured('/invoices').headers.get('content-security-policy');
    for (const source of [
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
      'https://link.com',
      'https://*.link.com',
      'https://*.hcaptcha.com',
      "'wasm-unsafe-eval'",
      "worker-src 'self' blob:",
      "img-src 'self' data: blob:",
    ])
      expect(csp).toContain(source);
    expect(csp).not.toContain("'unsafe-eval'");
  });
  it('leaves portfolio and experiment pages unchanged', () => {
    for (const path of ['/', '/blog', '/experiments', '/invoices-other']) {
      const response = new Response('page');
      expect(invoiceHeaders(request(path), response)).toBe(response);
    }
  });
});

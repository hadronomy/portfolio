import { describe, expect, it } from 'vitest';
import { clientAddress, clientAddressHeader } from './client-address.server';

const request = (headers: Record<string, string>) =>
  new Request('https://hadronomy.com/invoices', { headers });

describe('client address', () => {
  it('uses the Vercel hop, then the Cloudflare visitor', () => {
    expect(
      clientAddress(
        request({
          'x-vercel-forwarded-for': '104.16.10.1',
          'x-forwarded-for': '192.0.2.9',
          'cf-connecting-ip': '203.0.113.4',
        }),
        '127.0.0.1',
        true,
      ),
    ).toBe('203.0.113.4');
  });
  it('rejects a spoofed Cloudflare header from a direct Vercel visitor', () => {
    expect(
      clientAddress(
        request({
          'x-vercel-forwarded-for': '203.0.113.4',
          'cf-connecting-ip': '192.0.2.9',
        }),
        undefined,
        true,
      ),
    ).toBe('203.0.113.4');
  });
  it('uses a plain Node socket and ignores all supplied platform headers', () => {
    expect(
      clientAddress(
        request({
          'x-vercel-forwarded-for': '104.16.10.1',
          'x-forwarded-for': '192.0.2.9',
          'cf-connecting-ip': '192.0.2.9',
          [clientAddressHeader]: '192.0.2.9',
        }),
        '203.0.113.4',
      ),
    ).toBe('203.0.113.4');
  });
  it('trusts IPv6 and IPv4-mapped Cloudflare peers', () => {
    for (const peer of ['2606:4700::1234', '::ffff:104.16.10.1'])
      expect(
        clientAddress(request({ 'cf-connecting-ip': '2001:db8::1' }), peer),
      ).toBe('2001:db8::1');
  });
  it.each([
    '192.0.2.1, 192.0.2.2',
    'invalid',
    '',
    '203.0.113.1:443',
  ])('rejects invalid CF addresses: %s', (ip) => {
    expect(
      clientAddress(request({ 'cf-connecting-ip': ip }), '104.16.10.1'),
    ).toBe('104.16.10.1');
  });
  it('does not substitute public headers when the peer is absent or invalid', () => {
    expect(
      clientAddress(request({ 'cf-connecting-ip': '192.0.2.1' }), 'invalid'),
    ).toBeUndefined();
    expect(
      clientAddress(
        request({ 'x-forwarded-for': '192.0.2.1' }),
        undefined,
        true,
      ),
    ).toBeUndefined();
  });
  it('rejects a supplied private header when no platform peer exists', () => {
    expect(
      clientAddress(
        request({
          [clientAddressHeader]: '104.16.10.1',
          'cf-connecting-ip': '192.0.2.9',
        }),
      ),
    ).toBeUndefined();
  });
  it('does not trust addresses just outside Cloudflare subnets', () => {
    for (const peer of ['104.15.255.255', '104.32.0.1', '2a06:98c8::1'])
      expect(
        clientAddress(request({ 'cf-connecting-ip': '192.0.2.9' }), peer),
      ).toBe(peer);
  });
});

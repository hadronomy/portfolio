import { BlockList, isIP } from 'node:net';

/** Only the server entry writes this header. better-auth reads no public IP header. */
export const clientAddressHeader = 'x-invoice-client-address';

// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
// Retrieved 2026-10-12. Keep both lists in sync with Cloudflare before deployment.
const cloudflare = new BlockList();
for (const range of [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
]) {
  const [address, prefix] = range.split('/');
  if (address && prefix)
    cloudflare.addSubnet(
      address,
      Number(prefix),
      isIP(address) === 4 ? 'ipv4' : 'ipv6',
    );
}

const address = (value: string | null | undefined) => {
  const ip = value?.trim();
  return ip && isIP(ip) ? ip : undefined;
};

/**
 * At ingress, pass the socket address and the platform. Inside Start, the
 * overwritten private header carries the same answer to quote evidence.
 */
export function clientAddress(
  request: Request,
  peerAddress?: string,
  vercel = false,
): string | undefined {
  // Vercel sets this single-hop header itself. Public X-Forwarded-For can
  // change in a stacked proxy. Never infer the platform from request headers.
  // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
  const peer = address(
    vercel ? request.headers.get('x-vercel-forwarded-for') : peerAddress,
  );
  if (!peer) return undefined;
  if (cloudflare.check(peer, isIP(peer) === 4 ? 'ipv4' : 'ipv6'))
    return address(request.headers.get('cf-connecting-ip')) ?? peer;
  return peer;
}

// An agent stays connected until the owner disconnects it, as the consent
// page promises. That needs a refresh token, and the provider issues one only
// when `offline_access` was granted. The MCP spec tells servers not to
// advertise that scope, so clients that ask for what the resource lists ask
// for `invoices` alone, and their grant would end with the first access
// token, an hour in. The spec leaves refresh tokens to the authorization
// server; this module is that choice.

/**
 * The request, asking for `offline_access` as well when it is an agent's
 * authorization request for `resource` that names its scopes. Any other
 * request comes back as it was. A request without `scope` gets the client's
 * registered scopes, which already include `offline_access`.
 */
export function withOfflineAccess(
  request: Request,
  authorizePath: string,
  resource: string,
): Request {
  if (request.method !== 'GET') return request;
  const url = new URL(request.url);
  if (url.pathname !== authorizePath) return request;
  if (url.searchParams.get('resource') !== resource) return request;
  const scope = url.searchParams.get('scope');
  if (scope === null) return request;
  const scopes = scope.split(' ').filter(Boolean);
  if (scopes.includes('offline_access')) return request;
  url.searchParams.set('scope', [...scopes, 'offline_access'].join(' '));
  return new Request(url, request);
}

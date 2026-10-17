import { expect, test } from 'vitest';
import { withOfflineAccess } from './refresh';

const authorize = '/invoices/auth/oauth2/authorize';
const resource = 'https://hadronomy.com/invoices/mcp';
const request = (query: Record<string, string>, method = 'GET') =>
  new Request(
    `https://hadronomy.com${authorize}?${new URLSearchParams(query)}`,
    { method, headers: { cookie: 'session=1' } },
  );
const scopeOf = (request: Request) =>
  new URL(request.url).searchParams.get('scope');

test('an agent asking for the resource alone also gets offline access', () => {
  const asked = request({ resource, scope: 'invoices', state: 's' });
  const sent = withOfflineAccess(asked, authorize, resource);
  expect(scopeOf(sent)).toBe('invoices offline_access');
  expect(new URL(sent.url).searchParams.get('state')).toBe('s');
  expect(sent.headers.get('cookie')).toBe('session=1');
});

test('leaves every other request as it was', () => {
  const cases = [
    request({ resource, scope: 'invoices offline_access' }),
    request({ resource }),
    request({ resource: 'https://elsewhere.test/mcp', scope: 'invoices' }),
    request({ resource, scope: 'invoices' }, 'POST'),
  ];
  for (const asked of cases)
    expect(withOfflineAccess(asked, authorize, resource)).toBe(asked);
  const token = new Request(
    `https://hadronomy.com/invoices/auth/oauth2/token?resource=${resource}&scope=invoices`,
  );
  expect(withOfflineAccess(token, authorize, resource)).toBe(token);
});

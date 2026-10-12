import { describe, expect, it } from 'vitest';
import { sessionlessHandler } from './http.server';

describe('the sessionless HTTP adapter', () => {
  it.each([
    'initialize',
    'server/discover',
  ])('preserves an unexpected %s response and disposes its runtime', async (method) => {
    for (const body of ['<html>Unavailable</html>', 'null', '[]', '{']) {
      let disposed = false;
      const handler = sessionlessHandler(() => ({
        handler: async () =>
          new Response(body, { headers: { 'mcp-session-id': 'internal' } }),
        dispose: async () => {
          disposed = true;
        },
      }));
      const response = await handler(
        new Request('http://127.0.0.1/invoices/mcp', {
          method: 'POST',
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method }),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(body);
      expect(response.headers.has('mcp-session-id')).toBe(false);
      expect(disposed).toBe(true);
    }
  });
});

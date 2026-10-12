import {
  mailRetrySignatureHeader,
  mailRetryTimestampHeader,
  validMailRetry,
} from '@portfolio/invoices/mail-auth';
import { ConfigProvider, Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryMail } from './mail-retry';

const secret = 'a'.repeat(32);
const run = (effect: typeof retryMail) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            INVOICE_ORIGIN: 'https://example.test',
            INVOICE_MAIL_RETRY_SECRET: secret,
          }),
        ),
      ),
    ),
  );
afterEach(() => vi.unstubAllGlobals());
describe('scheduled mail retry', () => {
  it('signs the web endpoint request and waits for its response', async () => {
    const request = vi.fn<typeof fetch>(async (url, options) => {
      expect(String(url)).toBe(
        'https://example.test/invoices/internal/mail/retry',
      );
      expect(options?.method).toBe('POST');
      expect(options?.redirect).toBe('error');
      const headers = new Headers(options?.headers);
      expect(
        validMailRetry(
          secret,
          headers.get(mailRetryTimestampHeader) ?? '',
          headers.get(mailRetrySignatureHeader) ?? '',
        ),
      ).toBe(true);
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', request);
    await run(retryMail);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('reports a refused or unreachable endpoint without logging credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(run(retryMail)).rejects.toMatchObject({
      _tag: 'MailRetryFailure',
      message: 'Mail retry returned HTTP 401.',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Secret request details');
      }),
    );
    await expect(run(retryMail)).rejects.toMatchObject({
      _tag: 'MailRetryFailure',
      message: 'The web app did not answer the mail retry request.',
    });
  });
});

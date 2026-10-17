import {
  mailRetrySignature,
  validMailRetry,
} from '@portfolio/invoices/mail-auth';
import { describe, expect, it } from 'vitest';

describe('mail retry HMAC', () => {
  const secret = 'a'.repeat(32);
  const now = 1_790_000_000_000;
  const timestamp = String(now / 1000);
  const signature = mailRetrySignature(secret, timestamp);
  it('accepts only the shared key and a recent timestamp', () => {
    expect(validMailRetry(secret, timestamp, signature, now)).toBe(true);
    expect(validMailRetry('b'.repeat(32), timestamp, signature, now)).toBe(
      false,
    );
    expect(validMailRetry(secret, timestamp, signature, now + 301_000)).toBe(
      false,
    );
    expect(validMailRetry(secret, timestamp, signature, now - 31_000)).toBe(
      false,
    );
    expect(validMailRetry(secret, timestamp, signature.slice(0, 60), now)).toBe(
      false,
    );
    expect(validMailRetry(secret, `${timestamp}junk`, signature, now)).toBe(
      false,
    );
    expect(validMailRetry(secret, timestamp, 'g'.repeat(64), now)).toBe(false);
  });
});

import { createHmac, timingSafeEqual } from 'node:crypto';

export const mailRetryPath = '/invoices/internal/mail/retry';
export const mailRetryTimestampHeader = 'x-mail-retry-timestamp';
export const mailRetrySignatureHeader = 'x-mail-retry-signature';

/** Bind the timestamp to this method and endpoint. The request has no body. */
export const mailRetrySignature = (secret: string, timestamp: string) =>
  createHmac('sha256', secret)
    .update(`POST\n${mailRetryPath}\n${timestamp}`)
    .digest('hex');

export function validMailRetry(
  secret: string,
  timestamp: string,
  signature: string,
  now = Date.now(),
): boolean {
  if (!/^\d{10,11}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature))
    return false;
  const age = now - Number(timestamp) * 1000;
  if (age < -30_000 || age > 5 * 60 * 1000) return false;
  return timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(mailRetrySignature(secret, timestamp), 'hex'),
  );
}

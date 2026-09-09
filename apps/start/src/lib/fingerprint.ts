import { createServerFn } from '@tanstack/react-start';

export const fingerprint = createServerFn({ method: 'POST' })
  .validator((text: unknown) => {
    if (typeof text !== 'string' || text.length > 65536)
      throw new Error('Enter at most 65,536 characters.');
    return text;
  })
  .handler(async ({ data }) => {
    const bytes = new TextEncoder().encode(data);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return {
      hash: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      bytes: bytes.length,
    };
  });

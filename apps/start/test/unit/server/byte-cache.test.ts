import { describe, expect, it } from 'vitest';
import { ByteCache } from '~/server/byte-cache';

describe('page cache byte budget', () => {
  it('evicts by retained bytes and keeps the most recently read value', () => {
    const cache = new ByteCache<Uint8Array>(1000);
    cache.set('a', new Uint8Array(200), 200);
    cache.set('b', new Uint8Array(200), 200);
    expect(cache.get('a')).toBeDefined();
    cache.set('c', new Uint8Array(200), 200);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
    expect(cache.bytes).toBeLessThanOrEqual(1000);
  });
  it('does not retain a single image larger than the entire budget', () => {
    const cache = new ByteCache<Uint8Array>(1000);
    cache.set('large', new Uint8Array(1000), 1000);
    expect(cache.get('large')).toBeUndefined();
    expect(cache.bytes).toBe(0);
  });
  it('counts replacements and metadata entries without retaining PDFs', () => {
    const cache = new ByteCache<number>(800);
    cache.set('digest', 1, 24);
    const before = cache.bytes;
    cache.set('digest', 2, 24);
    expect(cache.bytes).toBe(before);
    for (let i = 0; i < 100; i++) cache.set(`digest-${i}`, i, 24);
    expect(cache.bytes).toBeLessThanOrEqual(800);
    expect(cache.get('digest-99')).toBe(99);
    expect(cache.get('digest-0')).toBeUndefined();
  });
});

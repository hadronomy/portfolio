import { Signature } from '@portfolio/invoices/quote-model';
import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

const svg = (
  box = '-16 -16 632 292',
  width = '632',
  height = '292',
  d = 'M0 0 Q600 260 600 260 Z',
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${width}" height="${height}"><path d="${d}" fill="#1d3fae"/></svg>`;
const valid = Schema.is(Signature);

describe('signature raster bounds', () => {
  it('accepts the full pad with export padding', () =>
    expect(valid(svg())).toBe(true));
  it.each([
    ['0 0 1000000 260', '1000000', '260'],
    ['0 0 600 1000000', '600', '1000000'],
    ['-1000000 0 600 260', '600', '260'],
    ['0 -1000000 600 260', '600', '260'],
    ['600 0 600 260', '600', '260'],
    ['0 0 0 260', '0', '260'],
    ['0 0 600 0', '600', '0'],
    ['0 0 600 260', '99999999', '260'],
  ])('rejects oversized or mismatched dimensions %s', (box, width, height) =>
    expect(valid(svg(box, width, height))).toBe(false));
  it.each([
    'M0 0 Q99999999 1 1 1 Z',
    'M0 0 Q1 -1000000 1 1 Z',
    'M0 0 Q1..2 1 1 1 Z',
    'M0 0 Q1 1 1 Z',
  ])('rejects oversized or malformed path coordinates %s', (d) =>
    expect(valid(svg(undefined, undefined, undefined, d))).toBe(false));
  it('bounds the work for each path and the number of paths', () => {
    expect(
      valid(
        svg(
          undefined,
          undefined,
          undefined,
          `M0 0 Q${'1 1 1 1 '.repeat(9000)}Z`,
        ),
      ),
    ).toBe(false);
    const path = '<path d="M0 0 Q1 1 1 1 Z" fill="#1d3fae"/>';
    expect(valid(svg().replace(/<path.*\/>/, path.repeat(129)))).toBe(false);
  });
});

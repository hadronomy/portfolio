import { Signature } from '@portfolio/invoices/quote-model';
import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  type InkStroke,
  signatureToSvg,
} from '../../components/arc/signature-pad/signature-pad';

// The server takes a signature only in the exact shape the pad exports. If
// the pad's export changes, this fails before a customer's signature does.

const stroke = (
  id: string,
  at: number,
  count: number,
  pen: boolean,
): InkStroke => ({
  id,
  color: 'blue',
  width: 'medium',
  at,
  points: Array.from({ length: count }, (_, index) => ({
    x: 40 + index * 7.31,
    y: 150 + Math.sin(index / 3) * 40,
    p: pen ? 0.5 : -1,
    t: index * 16,
  })),
});

describe('a drawn signature', () => {
  it('leaves the pad in the shape the server takes', () => {
    const svg = signatureToSvg([
      stroke('a', 0, 60, false),
      stroke('b', 1200, 30, true),
      stroke('c', 1600, 1, false),
    ]);
    expect(Schema.is(Signature)(svg)).toBe(true);
  });
});

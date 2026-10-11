import type { CSSProperties } from 'react';

// The document's shared measures and colours: the invoice page and a
// quote's pages draw from one set, so they read as one document.

/** A4 is 794 × 1123 CSS px. The side margin leaves a 706px column, which is the width the cover art is cut for. */
export const side = 44;
/**
 * The measure of running text. At 11.5px Geist this holds about 72
 * characters a line, inside the 60–75 that long text reads best at.
 */
export const measure = 470;
export const ink = '#141414';
export const soft = '#67676a';
export const faint = '#8e8e91';
export const rule = '#ebebec';
export const ruleStrong = '#d6d6d8';

export const label: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: faint,
};

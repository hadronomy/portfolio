import type { CSSProperties } from 'react';

// The document's shared measures and colours: the invoice page and a
// quote's pages draw from one set, so they read as one document.

/** A4 is 794 × 1123 CSS px. The side margin leaves a 706px column, which is the width the cover art is cut for. */
export const side = 44;
/**
 * A quote's pages run on two columns: headings hang in a narrow margin on
 * the left, text runs in the wide column beside it. At 12px Geist the text
 * column holds about 75 characters a line, the top of the 60–75 that long
 * reading is easiest at, and the margin keeps the page from reading as one
 * grey slab.
 */
export const grid = { aside: 150, gutter: 28, text: 528 } as const;
/** Long text is set a shade off black; pure ink stays for headings and figures. */
export const text = '#232326';
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

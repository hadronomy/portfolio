import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { m } from './paraglide/messages.js';

// Paraglide falls back to Spanish for a message English lacks, so a missing
// translation would show Spanish to an English customer without failing
// anything. These hold the two files to the same shape.

const read = (locale: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../messages/${locale}.json`, import.meta.url),
      'utf8',
    ),
  ) as Record<string, unknown>;
const es = read('es');
const en = read('en');

/** The placeholders and markup tags a pattern uses. */
const slots = (value: unknown) =>
  [...JSON.stringify(value).matchAll(/\{[#/]?([a-zA-Z]+)\/?\}/g)]
    .map((match) => match[0])
    .sort();
/** The inputs and selectors a message declares. */
const shape = (value: unknown) =>
  Array.isArray(value)
    ? value.map(({ declarations, selectors }) => ({ declarations, selectors }))
    : 'text';

describe('messages', () => {
  it('say the same things in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const key of Object.keys(es)) {
      expect(shape(en[key]), key).toEqual(shape(es[key]));
      expect([...new Set(slots(en[key]))], key).toEqual([
        ...new Set(slots(es[key])),
      ]);
    }
  });

  it('speak Spanish when no language is asked for', () => {
    expect(m.quote_days_left({ count: 3 })).toBe(
      m.quote_days_left({ count: 3 }, { locale: 'es' }),
    );
  });
});

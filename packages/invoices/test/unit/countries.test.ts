import { countryName, searchCountries } from '@portfolio/invoices/countries';
import { expect, test } from 'vitest';

const top = (query: string) => searchCountries(query)[0]?.code;

test('countries: found by the name people type', () => {
  expect(top('spa')).toBe('ES');
  expect(top('España')).toBe('ES');
  expect(top('espana')).toBe('ES');
  expect(top('swe')).toBe('SE');
  expect(top('Alemania')).toBe('DE');
  expect(top('uk')).toBe('GB');
  expect(top('usa')).toBe('US');
  expect(top('holland')).toBe('NL');
});

test('countries: an exact code wins over a name prefix', () => {
  // "es" also starts Estonia; the code is the stronger signal.
  expect(top('es')).toBe('ES');
  expect(searchCountries('es')[1]?.code).toBe('EE');
  expect(top('est')).toBe('EE');
});

test('countries: names, and nothing for gibberish', () => {
  expect(countryName('se')).toBe('Sweden');
  expect(countryName('QQ')).toBe(null);
  expect(searchCountries('zzzz')).toEqual([]);
  expect(searchCountries('').length > 240).toBeTruthy();
});

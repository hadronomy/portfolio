import { type CountryCode, countryCodes } from './address';

// Countries as the owner thinks of them: by name, in English or Spanish, or by
// the everyday short forms people type. The two-letter ISO code is what is
// stored and printed; nobody should have to know it to pick a country.

const eu = new Set(
  'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(
    ' ',
  ),
);

// What people type that neither the English nor the Spanish name starts with.
const aliases: Partial<Record<CountryCode, string[]>> = {
  GB: ['UK', 'United Kingdom', 'England', 'Scotland', 'Wales', 'Britain'],
  US: ['USA', 'America', 'EEUU', 'Estados Unidos'],
  NL: ['Holland'],
  CZ: ['Czech Republic'],
  AE: ['UAE', 'Emirates'],
  ES: ['Canarias', 'Canary Islands'],
  KR: ['Korea'],
  CI: ['Ivory Coast'],
};

/** Text folded for country and region name matching. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function namer(locale: string) {
  try {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return (code: string) => {
      const name = names.of(code);
      return name && name !== code ? name : null;
    };
  } catch {
    return () => null;
  }
}

const english = namer('en');
const spanish = namer('es');

export type Country = {
  code: CountryCode;
  name: string;
  eu: boolean;
  /** Names and aliases as written, English name first. */
  names: string[];
  /** The same, folded for matching. */
  terms: string[];
};

export const countries: readonly Country[] = countryCodes
  .map((code) => {
    const name = english(code) ?? code;
    const names = [name, spanish(code), ...(aliases[code] ?? [])].filter(
      (term): term is string => !!term,
    );
    return { code, name, eu: eu.has(code), names, terms: names.map(fold) };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const byCode = new Map<string, Country>(
  countries.map((country) => [country.code, country]),
);

/** The country a code names; takes any text, since codes arrive from input. */
export function countryOf(code: string) {
  return byCode.get(code.toUpperCase()) ?? null;
}

/** The English name of a two-letter code, or null if it is not one. */
export function countryName(code: string) {
  return countryOf(code)?.name ?? null;
}

/**
 * Countries matching what the owner typed, best first: the exact code or an
 * exact name or alias ("uk" is the UK, not Ukraine), then names that start
 * with it, then names with a word that does, then names
 * that merely contain it. Ties keep alphabetical order.
 */
export function searchCountries(query: string): Country[] {
  const q = fold(query.trim());
  if (!q) return [...countries];
  const rank = (country: Country) => {
    if (
      (q.length === 2 && country.code.toLowerCase() === q) ||
      country.terms.includes(q)
    )
      return 0;
    if (country.terms[0]?.startsWith(q)) return 1;
    if (country.terms.some((term) => term.startsWith(q))) return 2;
    if (
      country.terms.some((term) =>
        term.split(/[\s-]+/).some((word) => word.startsWith(q)),
      )
    )
      return 3;
    if (country.terms.some((term) => term.includes(q))) return 4;
    return null;
  };
  return countries
    .map((country) => ({ country, rank: rank(country) }))
    .filter(
      (entry): entry is { country: Country; rank: number } =>
        entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.country);
}

/**
 * The country a finished entry names: its code, or one of its names or
 * aliases in full. A partial entry names nothing, so leaving a field after
 * typing "a" never quietly picks Afghanistan.
 */
export function countryFor(text: string) {
  const q = fold(text.trim());
  if (!q) return null;
  return (
    countries.find(
      (country) =>
        country.code.toLowerCase() === q || country.terms.includes(q),
    ) ?? null
  );
}

/**
 * How a country's name finishes what was typed, in the language it was typed
 * in: "Alem" finishes as "Alemania", "Ger" as "Germany".
 */
export function completionOf(country: Country, query: string) {
  const q = fold(query.trim());
  if (!q) return undefined;
  return country.names[country.terms.findIndex((term) => term.startsWith(q))];
}

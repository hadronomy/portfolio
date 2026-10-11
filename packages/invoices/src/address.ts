import { Schema } from 'effect';
import { addressData } from './address-data';

// Postal addresses for any country, modelled the way libaddressinput models
// them: a fixed set of fields, and per-country metadata saying which of them
// a country uses, in what order its post reads them, what they are called,
// and which are required. The same metadata lays out the form and prints
// the invoice, so the two can never disagree.

export type CountryCode = keyof typeof addressData;
export const countryCodes = Object.keys(addressData) as CountryCode[];
export const CountryCode = Schema.Literals(countryCodes);

/**
 * A postal address. `lines` holds the street lines, separated by newlines.
 * `region` is the name as printed (a province, state, prefecture…).
 * Fields a country does not use stay empty.
 */
export const Address = Schema.Struct({
  lines: Schema.String,
  dependentLocality: Schema.String,
  locality: Schema.String,
  region: Schema.String,
  postalCode: Schema.String,
  sortingCode: Schema.String,
  country: CountryCode,
});
export interface Address extends Schema.Schema.Type<typeof Address> {}

export type AddressField = Exclude<keyof Address, 'country'>;

export const blankAddress = (country: CountryCode = 'ES'): Address => ({
  lines: '',
  dependentLocality: '',
  locality: '',
  region: '',
  postalCode: '',
  sortingCode: '',
  country,
});

const tokens: Record<string, AddressField> = {
  A: 'lines',
  D: 'dependentLocality',
  C: 'locality',
  S: 'region',
  Z: 'postalCode',
  X: 'sortingCode',
};

type Piece = { field: AddressField; before: string };
type Line = { pieces: Piece[]; after: string };

// "%Z %C %S" → the fields in order, each with the literal text before it.
function parse(fmt: string): Line[] {
  return fmt.split('%n').map((text) => {
    const pieces: Piece[] = [];
    let literal = '';
    for (let index = 0; index < text.length; index += 1) {
      const field = text[index] === '%' ? tokens[text[index + 1] ?? ''] : null;
      if (field) {
        pieces.push({ field, before: literal });
        literal = '';
        index += 1;
      } else literal += text[index];
    }
    return { pieces, after: literal };
  });
}

const formats = new Map<CountryCode, Line[]>();
const formatOf = (country: CountryCode) => {
  let lines = formats.get(country);
  if (!lines) {
    lines = parse(addressData[country].fmt);
    formats.set(country, lines);
  }
  return lines;
};

/** The fields a country uses, grouped by the line its post prints them on. */
export function addressLayout(country: CountryCode): AddressField[][] {
  return formatOf(country)
    .map((line) => line.pieces.map((piece) => piece.field))
    .filter((fields) => fields.length > 0);
}

/** Fields the country's post needs before a letter can be delivered. */
export function requiredFields(
  country: CountryCode,
): ReadonlySet<AddressField> {
  return new Set(
    [...addressData[country].require].flatMap((token) => tokens[token] ?? []),
  );
}

/**
 * The address as its country prints it, one string per line, without the
 * country itself. Separators only appear between fields that are present,
 * so a missing region never leaves a stray comma behind, and a value is
 * never printed twice: a Madrid address in the province of Madrid says
 * Madrid once.
 */
export function formatAddress(address: Address): string[] {
  const seen = new Set<string>();
  return formatOf(address.country)
    .flatMap(({ pieces, after }) => {
      let text = '';
      let printed = 0;
      pieces.forEach(({ field, before }, index) => {
        const value = address[field].trim();
        if (!value || seen.has(value.toLowerCase())) return;
        seen.add(value.toLowerCase());
        // Text that opens the line (〒 before a Japanese postal code) belongs
        // to its field; text between fields only joins two present ones.
        text += index === 0 || printed > 0 ? before : '';
        text += value;
        printed += 1;
      });
      return printed ? (text + after).split('\n') : [];
    })
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Where an address is, in one line and in the country's order: "35002 Las
 * Palmas de Gran Canaria, Las Palmas", "Mountain View, California 94043".
 * A postal code sits beside its neighbour; other parts take a comma.
 */
export function placeLine(address: Address): string {
  const parts: { field: AddressField; value: string }[] = [];
  for (const field of addressLayout(address.country).flat()) {
    const value = field === 'lines' ? '' : address[field].trim();
    if (value && !parts.some((part) => part.value === value))
      parts.push({ field, value });
  }
  return parts
    .map(({ field, value }, index) => {
      if (index === 0) return value;
      const previous = parts[index - 1]?.field;
      const joiner =
        field === 'postalCode' || previous === 'postalCode' ? ' ' : ', ';
      return joiner + value;
    })
    .join('');
}

const zipNames: Record<string, string> = {
  postal: 'Postal code',
  zip: 'ZIP code',
  pin: 'PIN code',
  eircode: 'Eircode',
};
const regionNames: Record<string, string> = {
  area: 'Area',
  county: 'County',
  department: 'Department',
  district: 'District',
  do_si: 'Province',
  emirate: 'Emirate',
  island: 'Island',
  oblast: 'Oblast',
  parish: 'Parish',
  prefecture: 'Prefecture',
  province: 'Province',
  state: 'State',
};
const localityNames: Record<string, string> = {
  city: 'Town or city',
  district: 'District',
  post_town: 'Post town',
  suburb: 'Suburb',
};
const sublocalityNames: Record<string, string> = {
  district: 'District',
  neighborhood: 'Neighbourhood',
  suburb: 'Suburb',
  townland: 'Townland',
  village_township: 'Village or township',
};
// Where the everyday word differs from the generic one. A Spanish address
// names a localidad, which may be a village as easily as a city.
const localWords: Partial<
  Record<CountryCode, Partial<Record<AddressField, string>>>
> = {
  ES: { locality: 'Locality' },
};

/** What each field is called in the country, in English. */
export function addressLabels(
  country: CountryCode,
): Record<AddressField, string> {
  const data = addressData[country];
  return {
    lines: 'Street address',
    dependentLocality: sublocalityNames[data.sublocalityName] ?? 'Suburb',
    locality: localityNames[data.localityName] ?? 'Town or city',
    region: regionNames[data.regionName] ?? 'Region',
    postalCode: zipNames[data.zipName] ?? 'Postal code',
    sortingCode: 'Sorting code',
    ...localWords[country],
  };
}

export type Region = {
  name: string;
  /** The same region in the local script, or its former name. */
  other: string;
  /** Matches the start of every postal code in the region, when known. */
  postal: RegExp | null;
};

const regionCache = new Map<CountryCode, readonly Region[]>();

/** The first-level subdivisions a country's addresses name, if it lists them. */
export function regionsOf(country: CountryCode): readonly Region[] {
  let regions = regionCache.get(country);
  if (!regions) {
    regions = addressData[country].regions.map((entry) => {
      const [name, other = '', zip = ''] = entry as readonly string[];
      return {
        name: name ?? '',
        other,
        postal: zip ? new RegExp(`^(?:${zip})`, 'i') : null,
      };
    });
    regionCache.set(country, regions);
  }
  return regions;
}

/**
 * The region a postal code belongs to, where the country's data says so:
 * 28013 is in Madrid, 94043 in California. Null when it cannot tell.
 */
export function regionOfPostalCode(country: CountryCode, postalCode: string) {
  const code = postalCode.trim();
  if (!code || !postalCodeValid(country, code)) return null;
  return regionsOf(country).find((region) => region.postal?.test(code)) ?? null;
}

/** An example postal code for the country, or '' if it has none. */
export const postalExample = (country: CountryCode) =>
  addressData[country].zipex;

/** Whether the country's post uses postal codes at all. */
export const usesPostalCode = (country: CountryCode) =>
  addressData[country].fmt.includes('%Z');

/** True when the code has the country's shape, or the country has no rule. */
export function postalCodeValid(country: CountryCode, postalCode: string) {
  const pattern = addressData[country].zip;
  return (
    !pattern || new RegExp(`^(?:${pattern})$`, 'i').test(postalCode.trim())
  );
}

/** Postal codes made only of digits, which want a numeric keyboard. */
export const numericPostalCode = (country: CountryCode) =>
  /^[\d\-\s]+$/.test(addressData[country].zipex);

import { Schema } from 'effect';
import {
  type Address,
  addressLayout,
  blankAddress,
  type CountryCode,
  CountryCode as CountryCodeSchema,
  placeLine,
  regionOfPostalCode,
  regionsOf,
} from './address';

// Photon (https://github.com/komoot/photon) is an OpenStreetMap geocoder
// built for search-as-you-type. This module reads its answers and turns them
// into Addresses. It holds no network code, so it runs and tests anywhere.

const Text = Schema.optional(Schema.String);

/** The part of a Photon feature an address is made from. */
export const PhotonProperties = Schema.Struct({
  osm_type: Text,
  osm_id: Schema.optional(Schema.Number),
  osm_value: Text,
  type: Text,
  name: Text,
  housenumber: Text,
  street: Text,
  postcode: Text,
  city: Text,
  locality: Text,
  district: Text,
  county: Text,
  state: Text,
  countrycode: Text,
});
export type PhotonProperties = typeof PhotonProperties.Type;

export const PhotonResponse = Schema.Struct({
  features: Schema.Array(Schema.Struct({ properties: PhotonProperties })),
});

/** One suggestion for the street field, ready to fill the whole address. */
export const AddressSuggestion = Schema.Struct({
  id: Schema.String,
  /** The street line, as the country writes it. */
  title: Schema.String,
  /** Where it is: postal code, locality, region. */
  detail: Schema.String,
  /** Whether it includes a house number, or names only the street. */
  precise: Schema.Boolean,
  address: Schema.Struct({
    lines: Schema.String,
    dependentLocality: Schema.String,
    locality: Schema.String,
    region: Schema.String,
    postalCode: Schema.String,
    sortingCode: Schema.String,
    country: CountryCodeSchema,
  }),
});
export type AddressSuggestion = typeof AddressSuggestion.Type;

// Where the house number goes. Most of Europe writes it after the street,
// Spain, Portugal, and Italy after a comma; these write it first.
const numberFirst = new Set<string>([
  'AU',
  'CA',
  'FR',
  'GB',
  'HK',
  'IE',
  'IL',
  'IN',
  'LU',
  'MY',
  'NZ',
  'PH',
  'SG',
  'US',
  'ZA',
]);
const numberAfterComma = new Set<string>(['ES', 'IT', 'PT']);

/** The street line: "Calle Mayor, 12", "1600 Amphitheatre Parkway". */
export function streetLine(country: CountryCode, street: string, number = '') {
  if (!number) return street;
  if (numberFirst.has(country)) return `${number} ${street}`;
  return numberAfterComma.has(country)
    ? `${street}, ${number}`
    : `${street} ${number}`;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * The region as the country's own list names it. The postal code decides
 * first, where the data allows: OpenStreetMap files Madrid under a region
 * but no province, and names some provinces differently from the post.
 */
function regionFor(country: CountryCode, properties: PhotonProperties) {
  const byPostal = regionOfPostalCode(country, properties.postcode ?? '');
  if (byPostal) return byPostal.name;
  const regions = regionsOf(country);
  const candidates = [properties.county, properties.state]
    .filter((name): name is string => !!name)
    .map(fold);
  const named = regions.find((region) =>
    candidates.some(
      (candidate) =>
        candidate === fold(region.name) ||
        (region.other && candidate === fold(region.other)),
    ),
  );
  if (named) return named.name;
  // A country without a list takes OpenStreetMap's name as it comes.
  return regions.length ? '' : (properties.state ?? properties.county ?? '');
}

/** An Address from a Photon result, or null when it is not one. */
export function fromPhoton(
  properties: PhotonProperties,
  country: CountryCode,
): AddressSuggestion | null {
  const street =
    properties.street ??
    (properties.type === 'street' ? properties.name : undefined);
  if (!street || properties.countrycode?.toUpperCase() !== country) return null;
  const fields = new Set(addressLayout(country).flat());
  const address: Address = {
    ...blankAddress(country),
    lines: streetLine(country, street, properties.housenumber),
    postalCode: properties.postcode ?? '',
    locality:
      properties.city ?? properties.locality ?? properties.district ?? '',
    dependentLocality: fields.has('dependentLocality')
      ? (properties.district ?? '')
      : '',
    region: fields.has('region') ? regionFor(country, properties) : '',
  };
  return {
    id: `${properties.osm_type ?? ''}${properties.osm_id ?? address.lines}`,
    title: address.lines,
    detail: placeLine(address),
    precise: !!properties.housenumber,
    address,
  };
}

/** Suggestions from a whole response, without repeats. */
export function suggestionsFrom(
  response: typeof PhotonResponse.Type,
  country: CountryCode,
): AddressSuggestion[] {
  const seen = new Set<string>();
  return response.features.flatMap(({ properties }) => {
    const suggestion = fromPhoton(properties, country);
    if (!suggestion) return [];
    const key = `${suggestion.title}|${suggestion.detail}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [suggestion];
  });
}

/** The locality a postal code names, from a postcode search. */
export function localityFrom(response: typeof PhotonResponse.Type) {
  const place = response.features.find(
    ({ properties }) => properties.osm_value === 'postcode' && properties.city,
  );
  return place?.properties.city ?? null;
}

import {
  fromPhoton,
  localityFrom,
  streetLine,
  suggestionsFrom,
} from '@portfolio/invoices/photon';
import { describe, expect, it } from 'vitest';

// Properties as Photon returned them for these searches in September 2026.
const madrid = {
  osm_type: 'N',
  osm_id: 3507556959,
  osm_value: 'house',
  type: 'house',
  housenumber: '12',
  street: 'Calle Mayor',
  locality: 'Barrio de los Austrias',
  district: 'Centro',
  city: 'Madrid',
  state: 'Comunidad de Madrid',
  postcode: '28013',
  countrycode: 'ES',
};
const triana = {
  osm_type: 'W',
  osm_id: 428035065,
  type: 'house',
  housenumber: '50',
  street: 'Calle Mayor de Triana',
  district: 'Triana',
  city: 'Las Palmas de Gran Canaria',
  county: 'Las Palmas',
  state: 'Canarias',
  postcode: '35002',
  countrycode: 'ES',
};
const googleplex = {
  osm_type: 'N',
  osm_id: 2192620021,
  type: 'house',
  housenumber: '1600',
  name: 'Googleplex',
  street: 'Amphitheatre Parkway',
  city: 'Mountain View',
  county: 'Santa Clara',
  state: 'California',
  postcode: '94043',
  countrycode: 'US',
};

describe('Photon results as addresses', () => {
  it('writes the street the way each country does', () => {
    expect(streetLine('ES', 'Calle Mayor', '12')).toBe('Calle Mayor, 12');
    expect(streetLine('US', 'Amphitheatre Parkway', '1600')).toBe(
      '1600 Amphitheatre Parkway',
    );
    expect(streetLine('DE', 'Unter den Linden', '77')).toBe(
      'Unter den Linden 77',
    );
  });

  it('takes the province from the postal code when OSM has none', () => {
    const suggestion = fromPhoton(madrid, 'ES');
    expect(suggestion?.address).toMatchObject({
      lines: 'Calle Mayor, 12',
      postalCode: '28013',
      locality: 'Madrid',
      region: 'Madrid',
      country: 'ES',
    });
    // Madrid the locality and Madrid the province print once.
    expect(suggestion?.detail).toBe('28013 Madrid');
    expect(suggestion?.precise).toBe(true);
  });

  it('names the province as the post does, not as OSM does', () => {
    expect(fromPhoton(triana, 'ES')?.address.region).toBe('Las Palmas');
    expect(fromPhoton(googleplex, 'US')?.address).toMatchObject({
      lines: '1600 Amphitheatre Parkway',
      locality: 'Mountain View',
      region: 'California',
      postalCode: '94043',
    });
  });

  it('keeps a street without a number, and marks it imprecise', () => {
    const street = fromPhoton(
      { ...triana, housenumber: undefined, type: 'street' },
      'ES',
    );
    expect(street?.title).toBe('Calle Mayor de Triana');
    expect(street?.precise).toBe(false);
  });

  it('drops places that are not addresses, or are in another country', () => {
    expect(fromPhoton({ ...madrid, street: undefined }, 'ES')).toBeNull();
    expect(fromPhoton(madrid, 'PT')).toBeNull();
  });

  it('removes repeats from a response', () => {
    const response = {
      features: [
        { properties: madrid },
        { properties: { ...madrid, osm_id: 1 } },
      ],
    };
    expect(suggestionsFrom(response, 'ES')).toHaveLength(1);
  });

  it('reads the locality of a postal code', () => {
    expect(
      localityFrom({
        features: [
          {
            properties: {
              osm_value: 'postcode',
              name: '28013',
              city: 'Madrid',
              countrycode: 'ES',
            },
          },
        ],
      }),
    ).toBe('Madrid');
  });
});

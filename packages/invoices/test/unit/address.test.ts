import {
  addressLabels,
  addressLayout,
  blankAddress,
  formatAddress,
  placeLine,
  postalCodeValid,
  regionOfPostalCode,
  regionsOf,
  requiredFields,
} from '@portfolio/invoices/address';
import { describe, expect, it } from 'vitest';

describe('address formats', () => {
  it('prints a Spanish address as Correos asks for it', () => {
    expect(
      formatAddress({
        ...blankAddress('ES'),
        lines: 'Calle Mayor, 12\n3º B',
        postalCode: '28013',
        locality: 'Madrid',
        region: 'Madrid',
      }),
    ).toEqual(['Calle Mayor, 12', '3º B', '28013 Madrid']);
    expect(
      formatAddress({
        ...blankAddress('ES'),
        lines: 'Calle San Juan, 3',
        postalCode: '38400',
        locality: 'Puerto de la Cruz',
        region: 'Santa Cruz de Tenerife',
      }),
    ).toEqual([
      'Calle San Juan, 3',
      '38400 Puerto de la Cruz',
      'Santa Cruz de Tenerife',
    ]);
  });

  it('prints a US address with its commas, and none left dangling', () => {
    const address = {
      ...blankAddress('US'),
      lines: '1600 Amphitheatre Pkwy',
      locality: 'Mountain View',
      region: 'California',
      postalCode: '94043',
    };
    expect(formatAddress(address)).toEqual([
      '1600 Amphitheatre Pkwy',
      'Mountain View, California 94043',
    ]);
    expect(formatAddress({ ...address, locality: '' })).toEqual([
      '1600 Amphitheatre Pkwy',
      'California 94043',
    ]);
  });

  it('says where an address is in one line, in the country’s order', () => {
    expect(
      placeLine({
        ...blankAddress('ES'),
        postalCode: '35002',
        locality: 'Las Palmas de Gran Canaria',
        region: 'Las Palmas',
      }),
    ).toBe('35002 Las Palmas de Gran Canaria, Las Palmas');
    expect(
      placeLine({
        ...blankAddress('US'),
        locality: 'Mountain View',
        region: 'California',
        postalCode: '94043',
      }),
    ).toBe('Mountain View, California 94043');
  });

  it('uses the Latin-script order for Japan', () => {
    expect(
      formatAddress({
        ...blankAddress('JP'),
        lines: '1-2-3 Shibuya',
        region: 'Tokyo',
        postalCode: '150-0002',
      }),
    ).toEqual(['1-2-3 Shibuya, Tokyo', '150-0002']);
  });

  it('lays out each country from its own format', () => {
    expect(addressLayout('ES')).toEqual([
      ['lines'],
      ['postalCode', 'locality'],
      ['region'],
    ]);
    expect(addressLayout('GB')).toEqual([
      ['lines'],
      ['locality'],
      ['postalCode'],
    ]);
  });

  it('names fields the way each country does', () => {
    expect(addressLabels('ES').region).toBe('Province');
    expect(addressLabels('ES').locality).toBe('Locality');
    expect(addressLabels('US').postalCode).toBe('ZIP code');
    expect(addressLabels('GB').locality).toBe('Post town');
    expect(addressLabels('IE').postalCode).toBe('Eircode');
    expect([...requiredFields('ES')].sort()).toEqual([
      'lines',
      'locality',
      'postalCode',
      'region',
    ]);
  });
});

describe('postal codes', () => {
  it('knows each country’s shape', () => {
    expect(postalCodeValid('ES', '28013')).toBe(true);
    expect(postalCodeValid('ES', '2801')).toBe(false);
    expect(postalCodeValid('GB', 'EC1Y 8SY')).toBe(true);
    expect(postalCodeValid('US', '94043-1351')).toBe(true);
  });

  it('finds the region a postal code belongs to', () => {
    expect(regionOfPostalCode('ES', '35007')?.name).toBe('Las Palmas');
    expect(regionOfPostalCode('ES', '38001')?.name).toBe(
      'Santa Cruz de Tenerife',
    );
    expect(regionOfPostalCode('ES', '15001')?.name).toBe('A Coruña');
    expect(regionOfPostalCode('US', '94043')?.name).toBe('California');
    expect(regionOfPostalCode('ES', '999')).toBeNull();
  });

  it('keeps former names so a search still finds the region', () => {
    const lleida = regionsOf('ES').find((region) => region.name === 'Lleida');
    expect(lleida?.other).toBe('Lérida');
  });
});

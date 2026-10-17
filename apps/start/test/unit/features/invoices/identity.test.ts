import { checkTaxId } from '@portfolio/invoices/tax-id';
import { expect, test } from 'vitest';
import {
  checkIban,
  completeEmail,
  correctEmail,
  formatIban,
  ownDomain,
} from '~/features/invoices/identity';

test('NIF: the letter is the number mod 23', () => {
  expect(checkTaxId('12345678Z').kind).toBe('valid');
  expect(checkTaxId('00000000T').kind).toBe('valid');
  expect(checkTaxId('12345678A').kind).toBe('invalid');
  // The error names the letter the number expects.
  expect((checkTaxId('43000000X') as { reason: string }).reason).toMatch(
    /for 43000000 is M/,
  );
  // Spaces, dashes, and case do not matter.
  expect(checkTaxId(' 12.345.678-z ')).toEqual({
    kind: 'valid',
    label: 'NIF · Individual',
    value: '12345678Z',
  });
});

test('NIE: X, Y, Z stand for 0, 1, 2', () => {
  // Y1234567 → 11234567 mod 23 = 10 → 'X'.
  expect(checkTaxId('Y1234567X').kind).toBe('valid');
  expect(checkTaxId('Y1234567A').kind).toBe('invalid');
});

test('CIF: digit control for A, B, E, H; letter or digit otherwise', () => {
  // 1234567: doubled odd places 2+6+1+5 plus even places 2+4+6 = 26 → 4.
  expect(checkTaxId('B12345674').kind).toBe('valid');
  expect(checkTaxId('B1234567D').kind).toBe('invalid');
  expect(checkTaxId('G1234567D').kind).toBe('valid');
  expect(checkTaxId('Q1234567D').kind).toBe('valid');
  expect(checkTaxId('Q12345674').kind).toBe('invalid');
});

test('VAT prefixes: ES is still checked, others only by shape', () => {
  expect(checkTaxId('ES12345678Z').kind).toBe('valid');
  expect(checkTaxId('ES12345678A').kind).toBe('invalid');
  expect(checkTaxId('SE556677889901').kind).toBe('foreign');
});

test('IBAN: mod 97, grouping, and the Spanish bank', () => {
  const result = checkIban('es9121000418450200051332');
  expect(result.kind).toBe('valid');
  if (result.kind === 'valid') {
    expect(result.value).toBe('ES91 2100 0418 4502 0005 1332');
    expect(result.bank?.name).toBe('CaixaBank');
  }
  expect(checkIban('ES9121000418450200051333').kind).toBe('invalid');
  expect(checkIban('ES91 2100')).toEqual({ kind: 'incomplete', missing: 16 });
  expect(formatIban('es91210004')).toBe('ES91 2100 04');
});

test('email: complete the provider, fix its common typos', () => {
  expect(completeEmail('ana@gm')).toBe('ana@gmail.com');
  expect(completeEmail('ana@hotmail.e')).toBe('ana@hotmail.es');
  expect(completeEmail('ana@gmail.com')).toBe(null);
  expect(completeEmail('ana@')).toBe(null);
  expect(completeEmail('ana@studio')).toBe(null);
  expect(correctEmail('Ana@gmial.com')).toBe('Ana@gmail.com');
  expect(correctEmail('ana@gmail.com')).toBe(null);
  expect(ownDomain('hello@hadronomy.com')).toBe('hadronomy.com');
  expect(ownDomain('ana@gmail.com')).toBe(null);
});

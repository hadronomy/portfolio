import { type CountryCode, formatAddress } from './address';
import type { Language, Party } from './model';

/**
 * The lines under a party's name, as the invoice prints them: email, the
 * address the way its own country's post writes it, the country only when
 * it differs from `home` (a letter within Spain does not say "Spain"), then
 * any `extra` lines and the tax ID.
 */
export function partyLines(
  party: Party,
  {
    home,
    language,
    taxLabel,
    extra = [],
  }: {
    home: CountryCode;
    language: Language;
    taxLabel: string;
    extra?: readonly string[];
  },
): string[] {
  const { country } = party.address;
  return [
    party.email,
    ...formatAddress(party.address),
    country !== home
      ? (new Intl.DisplayNames([language], { type: 'region' }).of(country) ??
        country)
      : '',
    ...extra,
    party.taxId ? `${taxLabel} ${party.taxId}` : '',
  ].filter(Boolean);
}

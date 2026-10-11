import type { CountryCode } from '@portfolio/invoices/address';
import {
  type Country,
  completionOf,
  countries,
  countryFor,
  countryOf,
  searchCountries,
} from '@portfolio/invoices/countries';
import { Picker } from './picker';

/**
 * A country, picked by name and stored as its two-letter code. Typing
 * searches English and Spanish names, everyday aliases, and codes, and the
 * best match completes in the language it was typed in.
 */
export function CountryField({
  value,
  onChange,
  disabled = false,
  className,
  autoComplete,
}: {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  return (
    <Picker<Country>
      label="Country"
      listLabel="countries"
      {...(className ? { className } : {})}
      disabled={disabled}
      text={countryOf(value)?.name ?? value}
      options={(query) => (query === null ? countries : searchCountries(query))}
      keyOf={(country) => country.code}
      nameOf={(country) => country.name}
      aside={(country) => country.code}
      isCurrent={(country) => country.code === value}
      complete={completionOf}
      resolve={countryFor}
      onPick={(country) => onChange(country.code)}
      empty={(query) => `No country matches “${query}”.`}
      {...(autoComplete ? { autoComplete } : {})}
    />
  );
}

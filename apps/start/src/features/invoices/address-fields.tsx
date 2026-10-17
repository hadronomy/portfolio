import {
  type Address,
  type AddressField,
  addressLabels,
  addressLayout,
  numericPostalCode,
  postalCodeValid,
  postalExample,
  type Region,
  regionOfPostalCode,
  regionsOf,
  requiredFields,
} from '@portfolio/invoices/address';
import { type AddressSuggestion, streetLine } from '@portfolio/invoices/photon';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Combobox } from '~/features/invoices/combobox';
import { CountryField } from '~/features/invoices/country-field';
import { Picker } from '~/features/invoices/picker';
import { invoiceQueries } from '~/features/invoices/queries';
import { Field } from '~/features/invoices/ui';

// A postal address laid out the way its country writes it. The country comes
// first because it decides everything after it: which fields exist, what
// they are called, their order, and what a valid postal code looks like.
// Each field then fills what it can for the others. A street suggestion
// fills the whole address, a postal code names its province outright, and
// its locality is offered as a ghost.

const columns = 6;
// How wide each field wants to be, in sixths of the address block.
const spans: Record<AddressField, number> = {
  lines: 6,
  locality: 4,
  dependentLocality: 3,
  region: 3,
  postalCode: 2,
  sortingCode: 2,
};

/**
 * The country's lines as grid rows: fields keep the line their post puts
 * them on, wrap when a line is too full, and the last field of each row
 * takes whatever room is left.
 */
export function packAddress(layout: AddressField[][]) {
  const rows: { field: AddressField; span: number }[][] = [];
  for (const line of layout) {
    let row: { field: AddressField; span: number }[] = [];
    let used = 0;
    for (const field of line) {
      const span = spans[field];
      if (used + span > columns && row.length) {
        rows.push(row);
        row = [];
        used = 0;
      }
      row.push({ field, span });
      used += span;
    }
    rows.push(row);
  }
  for (const row of rows) {
    const last = row.at(-1);
    if (last)
      last.span += columns - row.reduce((sum, { span }) => sum + span, 0);
  }
  return rows;
}

/** A value that trails its source by `delay`, for searches worth waiting on. */
function useDebounced<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export function AddressFields({
  value,
  onChange,
  disabled = false,
  self = false,
}: {
  value: Address;
  onChange: (value: Address) => void;
  disabled?: boolean;
  /** The owner's own address: the only one the browser may autofill. */
  self?: boolean;
}) {
  const { country } = value;
  const labels = addressLabels(country);
  const required = requiredFields(country);
  const regions = regionsOf(country);
  const auto = (token: string) => (self ? token : 'off');
  const label = (field: AddressField) =>
    required.has(field) ? labels[field] : `${labels[field]} (optional)`;

  // Fields the form filled in for the owner, each with a counter that plays
  // its settle animation when it moves.
  const [settled, setSettled] = useState<Partial<Record<AddressField, number>>>(
    {},
  );
  function fill(next: Address, changed: AddressField[]) {
    onChange(next);
    if (!changed.length) return;
    setSettled((current) => {
      const bumped = { ...current };
      for (const field of changed) bumped[field] = (bumped[field] ?? 0) + 1;
      return bumped;
    });
  }
  const set = (field: AddressField, text: string) =>
    onChange({ ...value, [field]: text });

  const [first = '', ...more] = value.lines.split('\n');
  const second = more.join('\n');
  const joinLines = (line1: string, line2: string) =>
    line2 ? `${line1}\n${line2}` : line1;
  const [secondLine, setSecondLine] = useState(false);
  const secondRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (secondLine) secondRef.current?.querySelector('input')?.focus();
  }, [secondLine]);

  // Street search: what was typed, debounced, then asked of the server.
  const [typed, setTyped] = useState('');
  const query = useDebounced(typed, 250);
  const search = useQuery({
    ...invoiceQueries.addresses(country, query),
    enabled: !disabled && query.trim().length >= 3,
    // The last answer stays up while the next is on its way, so the list
    // refines under the pointer instead of blinking empty on every key.
    placeholderData: keepPreviousData,
  });

  // A postal code names its locality; offered as a ghost while it is empty.
  const postalOk =
    !!value.postalCode.trim() && postalCodeValid(country, value.postalCode);
  const locality = useQuery({
    ...invoiceQueries.locality(country, value.postalCode),
    enabled: !disabled && postalOk && !value.locality.trim(),
  });

  const [postalLeft, setPostalLeft] = useState(() => !!value.postalCode.trim());
  const example = postalExample(country);

  function takeSuggestion(suggestion: AddressSuggestion) {
    // A street without a number is left ready for one: the caret lands
    // where the number goes, after "Calle Mayor, " or "Unter den Linden ".
    const sample = streetLine(country, '\u0001', '\u0002');
    const joiner = sample.startsWith('\u0001') ? sample.slice(1, -1) : '';
    const street = suggestion.precise
      ? suggestion.address.lines
      : suggestion.address.lines + joiner;
    const next = { ...suggestion.address, lines: joinLines(street, second) };
    const changed = (Object.keys(next) as (keyof Address)[]).filter(
      (key): key is AddressField =>
        key !== 'country' && key !== 'lines' && next[key] !== value[key],
    );
    setTyped('');
    fill(next, changed);
  }

  function renderField(field: AddressField) {
    switch (field) {
      case 'lines':
        return (
          <>
            <Combobox<AddressSuggestion>
              label={labels.lines}
              listLabel="address suggestions"
              disabled={disabled}
              text={first}
              options={(q) => (q === null ? [] : (search.data ?? []))}
              keyOf={(suggestion) => suggestion.id}
              onText={(text) => {
                setTyped(text);
                set('lines', joinLines(text, second));
              }}
              onPick={takeSuggestion}
              render={(suggestion) => (
                <span className="iv-combo-place">
                  <span>{suggestion.title}</span>
                  <small>{suggestion.detail}</small>
                </span>
              )}
              // OpenStreetMap's data is open on condition of this credit.
              footer="Suggestions © OpenStreetMap contributors"
              autoComplete={auto('address-line1')}
              placeholder={
                country === 'ES' ? 'Calle Mayor, 12' : 'Street and number'
              }
            />
            {second || secondLine ? (
              <div ref={secondRef}>
                <Field
                  label="Apartment, floor, etc. (optional)"
                  value={second}
                  disabled={disabled}
                  input={{ autoComplete: auto('address-line2') }}
                  onChange={(text) => set('lines', joinLines(first, text))}
                  onBlur={() => {
                    if (!second.trim()) setSecondLine(false);
                  }}
                />
              </div>
            ) : (
              !disabled && (
                <button
                  type="button"
                  className="iv-address-more"
                  onClick={() => setSecondLine(true)}
                >
                  <Plus size={13} />
                  <span>Apartment, floor, etc.</span>
                </button>
              )
            )}
          </>
        );
      case 'postalCode':
        return (
          <Field
            label={label('postalCode')}
            value={value.postalCode}
            disabled={disabled}
            placeholder={example}
            {...(settled.postalCode ? { settle: settled.postalCode } : {})}
            input={{
              autoComplete: auto('postal-code'),
              inputMode: numericPostalCode(country) ? 'numeric' : 'text',
              maxLength: 12,
              spellCheck: false,
            }}
            {...(postalLeft && value.postalCode.trim() && !postalOk
              ? {
                  error: example
                    ? `Expected a ${labels.postalCode.toLowerCase()} like ${example}.`
                    : `This ${labels.postalCode.toLowerCase()} has the wrong format.`,
                }
              : {})}
            onChange={(text) => {
              setPostalLeft(false);
              // The code decides the province; a different one would be a
              // contradiction on the invoice, so it follows the code.
              const region = regionOfPostalCode(country, text)?.name;
              const next = { ...value, postalCode: text };
              if (region && region !== value.region)
                fill({ ...next, region }, ['region']);
              else onChange(next);
            }}
            onBlur={() => {
              setPostalLeft(true);
              const tidy = value.postalCode.trim().toUpperCase();
              if (tidy !== value.postalCode) set('postalCode', tidy);
            }}
          />
        );
      case 'locality':
        return (
          <Field
            label={label('locality')}
            value={value.locality}
            disabled={disabled}
            suggest={locality.data ?? undefined}
            {...(settled.locality ? { settle: settled.locality } : {})}
            input={{ autoComplete: auto('address-level2') }}
            onChange={(text) => set('locality', text)}
          />
        );
      case 'region':
        return regions.length ? (
          <Picker<Region>
            label={label('region')}
            listLabel={`${labels.region.toLowerCase()}s`}
            disabled={disabled}
            text={value.region}
            {...(settled.region ? { settle: settled.region } : {})}
            options={(q) => {
              if (q === null) return regions;
              // Names that start with the text come first: they are what
              // the owner is spelling, and the best one completes as a ghost.
              const needle = fold(q);
              const names = (region: Region) => [
                fold(region.name),
                fold(region.other),
              ];
              const starts = regions.filter((region) =>
                names(region).some((name) => name.startsWith(needle)),
              );
              const contains = regions.filter(
                (region) =>
                  !starts.includes(region) &&
                  names(region).some((name) => name.includes(needle)),
              );
              return [...starts, ...contains];
            }}
            keyOf={(region) => region.name}
            nameOf={(region) => region.name}
            aside={(region) => region.other}
            isCurrent={(region) => region.name === value.region}
            complete={(region, q) =>
              [region.name, region.other].find((name) =>
                fold(name).startsWith(fold(q)),
              )
            }
            resolve={(text) =>
              regions.find(
                (region) =>
                  fold(region.name) === fold(text) ||
                  (!!region.other && fold(region.other) === fold(text)),
              ) ?? null
            }
            onPick={(region) => set('region', region.name)}
            empty={(q) => `No ${labels.region.toLowerCase()} matches “${q}”.`}
            autoComplete={auto('address-level1')}
          />
        ) : (
          <Field
            label={label('region')}
            value={value.region}
            disabled={disabled}
            input={{ autoComplete: auto('address-level1') }}
            onChange={(text) => set('region', text)}
          />
        );
      case 'dependentLocality':
        return (
          <Field
            label={label('dependentLocality')}
            value={value.dependentLocality}
            disabled={disabled}
            {...(settled.dependentLocality
              ? { settle: settled.dependentLocality }
              : {})}
            input={{ autoComplete: auto('address-level3') }}
            onChange={(text) => set('dependentLocality', text)}
          />
        );
      case 'sortingCode':
        return (
          <Field
            label={label('sortingCode')}
            value={value.sortingCode}
            disabled={disabled}
            onChange={(text) => set('sortingCode', text)}
          />
        );
    }
  }

  return (
    <div className="iv-address">
      <div className="iv-address-cell" style={{ gridColumn: 'span 6' }}>
        <CountryField
          value={country}
          disabled={disabled}
          autoComplete={auto('country')}
          // A region belongs to its country; the rest may well carry over.
          onChange={(code) => onChange({ ...value, country: code, region: '' })}
        />
      </div>
      {packAddress(addressLayout(country)).flatMap((row) =>
        row.map(({ field, span }) => (
          <div
            key={field}
            className="iv-address-cell"
            style={{ gridColumn: `span ${span}` }}
          >
            {renderField(field)}
          </div>
        )),
      )}
    </div>
  );
}

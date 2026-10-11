import { type Address, regionOfPostalCode } from '@portfolio/invoices/address';
import { countryOf } from '@portfolio/invoices/countries';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { useState } from 'react';
import { type Territory, territories, territoryNames } from './choices';
import {
  checkEmail,
  checkIban,
  checkTaxId,
  completeEmail,
  correctEmail,
  formatIban,
} from './identity';
import { Field, MorphText, Select, Tip } from './ui';

// Fields that know their data. Help lives where the eye already is: a likely
// value is drawn inside the field as a ghost that Tab accepts, and a checked
// value earns a quiet mark. Text under a field is kept for errors and for
// one-click fixes, never for a label restating what the field is.
//
// Errors follow one rule: a value that checks out is confirmed at once, but
// a problem is only named when the owner leaves the field. It stays while
// they read it, steps aside the moment they start fixing it, and comes back
// on leaving only if the fix did not take. Clean-up (spacing, case,
// grouping) happens on blur, never under the caret.

/**
 * Tracks whether the field's problems may show. A value that was already
 * there when the field mounted was left long ago, so its problem shows at
 * once: a stored typo must not hide until someone happens to focus it.
 */
function useLateErrors(value: string) {
  const [left, setLeft] = useState(() => value.trim() !== '');
  return {
    left,
    leave: () => setLeft(true),
    /** Wraps onChange: editing puts the error aside until the next blur. */
    editing: (change: (next: string) => void) => (next: string) => {
      setLeft(false);
      change(next);
    },
  };
}

/** A check that draws itself in when a value becomes valid; hover says why. */
function Verified({ label }: { label: string }) {
  return (
    <Tip label={label} side="top">
      <span className="iv-check-mark" data-state="in">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3.75 8.25 6.5 11l5.75-6.25"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 13, strokeDashoffset: 13 }}
          />
        </svg>
      </span>
    </Tip>
  );
}

type Base = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * NIF, NIE, CIF, or an EU VAT number. Spanish IDs are checked against their
 * control character, so a typo shows before the invoice leaves; the check
 * mark names the kind of ID it found.
 */
export function TaxIdField({
  label = 'Tax ID (NIF)',
  country,
  ...field
}: Base & { label?: string; country: string }) {
  const { left, leave, editing } = useLateErrors(field.value);
  const check = checkTaxId(field.value, country || 'ES');
  const good = check.kind === 'valid' || check.kind === 'foreign';
  return (
    <Field
      {...field}
      label={label}
      onChange={editing(field.onChange)}
      placeholder="NIF, NIE, CIF or VAT"
      input={{ autoCapitalize: 'characters', spellCheck: false }}
      {...(check.kind === 'valid'
        ? {
            tone: 'valid' as const,
            end: <Verified label={check.label} />,
            describe: check.label,
          }
        : {})}
      {...(check.kind === 'foreign' ? { describe: check.label } : {})}
      {...(check.kind === 'invalid' && left ? { error: check.reason } : {})}
      onBlur={() => {
        leave();
        if (good && check.value !== field.value) field.onChange(check.value);
      }}
    />
  );
}

/**
 * An IBAN, grouped in fours when the owner leaves the field or pastes one.
 * The checksum catches a mistyped digit; the check mark names the bank.
 */
export function IbanField(field: Base) {
  const { left, leave, editing } = useLateErrors(field.value);
  const check = checkIban(field.value);
  const change = editing(field.onChange);
  const found =
    check.kind === 'valid'
      ? check.bank
        ? `${check.bank.name} · ${check.bank.bic}`
        : 'Valid IBAN'
      : null;
  return (
    <Field
      {...field}
      label="IBAN"
      onChange={change}
      placeholder="ES91 2100 0418 4502 0005 1332"
      input={{
        autoCapitalize: 'characters',
        spellCheck: false,
        onPaste: (event: ClipboardEvent<HTMLInputElement>) => {
          // A pasted IBAN replacing the whole field arrives already grouped.
          const target = event.currentTarget;
          const whole =
            target.selectionStart === 0 &&
            target.selectionEnd === target.value.length;
          if (!whole) return;
          event.preventDefault();
          change(formatIban(event.clipboardData.getData('text')));
        },
      }}
      {...(found
        ? {
            tone: 'valid' as const,
            end: <Verified label={found} />,
            describe: found,
          }
        : {})}
      {...(check.kind === 'invalid' && left ? { error: check.reason } : {})}
      {...(check.kind === 'incomplete' && left
        ? { error: `This IBAN is ${check.missing} characters short.` }
        : {})}
      onBlur={() => {
        leave();
        const grouped = formatIban(field.value);
        if (grouped !== field.value) field.onChange(grouped);
      }}
    />
  );
}

const bicShape = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** A BIC, upper case as it is printed; `bank` is the IBAN's, as the ghost. */
export function BicField({
  bank,
  ...field
}: Base & { bank?: string | undefined }) {
  const { left, leave, editing } = useLateErrors(field.value);
  return (
    <Field
      {...field}
      label="BIC / SWIFT"
      placeholder="CAIXESBBXXX"
      suggest={bank}
      input={{ autoCapitalize: 'characters', maxLength: 11, spellCheck: false }}
      onChange={editing((next) =>
        field.onChange(next.toUpperCase().replace(/[^A-Z0-9]/g, '')),
      )}
      {...(field.value && !bicShape.test(field.value) && left
        ? { error: 'A BIC has 8 or 11 characters, like CAIXESBBXXX.' }
        : {})}
      onBlur={leave}
    />
  );
}

/**
 * An email address. Typing past the @ completes the usual mailbox providers
 * as a ghost, and a misspelt provider is offered corrected, in one click.
 */
export function EmailField({
  self = false,
  ...field
}: Base & { self?: boolean }) {
  const { left, leave, editing } = useLateErrors(field.value);
  const verdict = checkEmail(field.value);
  const corrected = correctEmail(field.value.trim());
  return (
    <Field
      {...field}
      label="Email"
      onChange={editing(field.onChange)}
      type="email"
      placeholder="accounts@example.com"
      suggest={completeEmail(field.value) ?? undefined}
      input={{
        autoComplete: self ? 'email' : 'off',
        spellCheck: false,
        autoCapitalize: 'none',
      }}
      {...(verdict === 'invalid' && left
        ? { error: 'This email address looks incomplete.' }
        : {})}
      {...(corrected && !field.disabled
        ? {
            hint: (
              <button
                type="button"
                className="iv-hint-action"
                onClick={() => field.onChange(corrected.toLowerCase())}
              >
                Use {corrected.toLowerCase()}
              </button>
            ),
          }
        : {})}
      onBlur={() => {
        leave();
        const tidy = field.value.trim().toLowerCase();
        if (tidy !== field.value) field.onChange(tidy);
      }}
    />
  );
}

/**
 * A web address, stored bare: no scheme, no trailing slash. `domain` is the
 * one the owner's email already uses, offered as the ghost.
 */
export function WebsiteField({
  domain,
  ...field
}: Base & { domain?: string | undefined }) {
  return (
    <Field
      {...field}
      label="Website"
      placeholder="example.com"
      suggest={domain}
      input={{ autoComplete: 'url', spellCheck: false, autoCapitalize: 'none' }}
      onBlur={() => {
        const bare = field.value
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/\/$/, '')
          .toLowerCase();
        if (bare !== field.value) field.onChange(bare);
      }}
    />
  );
}

const decimals = (text: string) => text.split('.')[1]?.length ?? 0;

/**
 * Keeps what the owner types a decimal the model accepts: a comma becomes the
 * point (Spanish keyboards type 12,50), stray characters are dropped, and
 * only one point survives.
 */
function toDecimal(text: string) {
  const cleaned = text.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 6)}` : whole;
}

/**
 * A decimal amount. Arrow keys step it (Shift for ten, Alt for a tenth), the
 * unit sits inside the field, and on blur it settles to a tidy form. Where
 * the unit is a choice (a discount in % or €), the unit itself is the switch:
 * the choice sits where the eye already reads it, not in a second field.
 */
export function AmountField({
  label,
  unit,
  unitSwitch,
  step = 1,
  hint,
  ...field
}: Base & {
  label: string;
  /** Shown inside the field after the number: €, %, days. */
  unit?: string;
  unitSwitch?: { label: string; onSwitch: () => void } | undefined;
  step?: number;
  hint?: ReactNode;
}) {
  function nudge(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const by =
      (event.shiftKey ? step * 10 : event.altKey ? step / 10 : step) *
      (event.key === 'ArrowUp' ? 1 : -1);
    const current = Number(field.value) || 0;
    const places = Math.max(
      decimals(field.value),
      decimals(String(Math.abs(by))),
    );
    const next = Math.max(0, current + by);
    field.onChange(next.toFixed(Math.min(places, 6)));
  }
  return (
    <Field
      {...field}
      label={label}
      numeric
      {...(unit
        ? {
            end:
              unitSwitch && !field.disabled ? (
                <Tip label={unitSwitch.label} side="top">
                  <button
                    type="button"
                    className="iv-unit-switch"
                    aria-label={unitSwitch.label}
                    // Focus stays in the number, ready for the next digit.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={unitSwitch.onSwitch}
                  >
                    <MorphText>{unit}</MorphText>
                  </button>
                </Tip>
              ) : (
                unit
              ),
          }
        : {})}
      {...(hint ? { hint } : {})}
      onChange={(next) => field.onChange(toDecimal(next))}
      onKeyDown={nudge}
      input={{ autoComplete: 'off', spellCheck: false }}
      onBlur={() => {
        // "007" → "7", "12." → "12", "" → "0".
        const [whole = '', part] = field.value.split('.');
        const tidy =
          (whole.replace(/^0+(?=\d)/, '') || '0') + (part ? `.${part}` : '');
        if (tidy !== field.value) field.onChange(tidy);
      }}
    />
  );
}

/**
 * The invoice number series. The number it produces is drawn after it, in
 * the field, so the prefix is always read as part of a real number.
 */
export function SeriesField({
  label = 'Number series',
  ...field
}: Base & { label?: string }) {
  const valid = /^[A-Z0-9][A-Z0-9-]{0,15}$/.test(field.value);
  const year = new Date().getFullYear();
  return (
    <Field
      {...field}
      label={label}
      preview={valid ? `-${year}-0001` : undefined}
      describe={
        valid ? `Numbers look like ${field.value}-${year}-0001` : undefined
      }
      input={{ autoCapitalize: 'characters', maxLength: 16, spellCheck: false }}
      onChange={(next) =>
        field.onChange(next.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
      }
      {...(field.value && !valid
        ? { error: 'Start with a letter or digit.' }
        : {})}
    />
  );
}

const day = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const addDays = (iso: string, days: number) =>
  new Date(toTime(iso) + days * day).toISOString().slice(0, 10);
const terms = [15, 30, 60];

/**
 * The due date, with the usual payment terms one click away. The row reads
 * as one phrase, "15 30 60 days": the chosen term is pressed, and any other
 * gap takes its place in order as a pressed number, so "45 days" is visible
 * without arithmetic.
 */
export function DueDateField({
  issueDate,
  ...field
}: Base & { issueDate: string }) {
  const gap = Math.round((toTime(field.value) - toTime(issueDate)) / day);
  const known = Number.isFinite(gap) && gap >= 0;
  const shown = known && !terms.includes(gap) ? [...terms, gap] : terms;
  return (
    <Field
      {...field}
      label="Due date"
      type="date"
      {...(Number.isFinite(gap) && gap < 0
        ? { error: 'The due date is before the issue date.' }
        : {})}
      {...(field.disabled
        ? {}
        : {
            hint: (
              <fieldset className="iv-quick">
                <legend className="iv-sr">Payment terms, in days</legend>
                {[...shown]
                  .sort((a, b) => a - b)
                  .map((net) =>
                    terms.includes(net) ? (
                      <button
                        key={net}
                        type="button"
                        aria-pressed={gap === net}
                        onClick={() => field.onChange(addDays(issueDate, net))}
                      >
                        {net}
                      </button>
                    ) : (
                      <span key={net} className="iv-quick-custom">
                        {net}
                      </span>
                    ),
                  )}
                <span className="iv-quick-unit">days</span>
              </fieldset>
            ),
          })}
    />
  );
}

// IGIC applies in the Canary Islands, and Ceuta and Melilla have their own
// tax (IPSI), so a Spanish address splits three ways by its province.
const canary = new Set(['Las Palmas', 'Santa Cruz de Tenerife']);
const ipsi = new Set(['Ceuta', 'Melilla']);

/** The tax territory an address lies in, or null when it cannot tell. */
export function territoryOf(address: Address): Territory | null {
  if (address.country !== 'ES') {
    const country = countryOf(address.country);
    return country ? (country.eu ? 'eu' : 'other') : null;
  }
  const region =
    address.region || regionOfPostalCode('ES', address.postalCode)?.name;
  if (!region || ipsi.has(region)) return null;
  return canary.has(region) ? 'canary-islands' : 'mainland-spain';
}

/**
 * The customer's tax territory. Where the customer is already says it: a
 * Spanish province, or a foreign country's EU membership. When that
 * disagrees with the choice, the match is offered in one click, without
 * overriding what the owner picked.
 */
export function TerritorySelect({
  value,
  onChange,
  address,
  disabled = false,
}: {
  value: Territory;
  onChange: (value: Territory) => void;
  address: Address;
  disabled?: boolean;
}) {
  const suggested = territoryOf(address);
  const where =
    address.country === 'ES'
      ? address.region || regionOfPostalCode('ES', address.postalCode)?.name
      : countryOf(address.country)?.name;
  return (
    <Select
      label="Territory"
      value={value}
      disabled={disabled}
      onChange={onChange}
      options={territories}
      {...(suggested && suggested !== value && !disabled
        ? {
            hint: (
              <>
                <span>
                  {where} is{' '}
                  {suggested === 'eu'
                    ? 'in the EU'
                    : suggested === 'other'
                      ? 'outside the EU'
                      : `in ${territoryNames[suggested]}`}
                  .
                </span>
                <button
                  type="button"
                  className="iv-hint-action"
                  onClick={() => onChange(suggested)}
                >
                  Use {territoryNames[suggested]}
                </button>
              </>
            ),
          }
        : {})}
    />
  );
}

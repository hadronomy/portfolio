import { formatMoney } from '@portfolio/invoices/calculate';
import type { CheckoutInvoice } from '@portfolio/invoices/collection-model';
import type { Language } from '@portfolio/invoices/model';

// Money as the customer's pages show and read it.

/**
 * A money formatter bound to the invoice's language and currency. A credit
 * takes a true minus sign, the width of a digit, not the hyphen Intl writes.
 */
export const moneyOf =
  (invoice: Pick<CheckoutInvoice, 'language' | 'currency'>) =>
  (amount: string) =>
    formatMoney(amount, invoice.language, invoice.currency).replace(
      '-',
      '\u2212',
    );

/**
 * Reads an amount the way people type it: "250", "250,5", "1.250,00",
 * "1,250.00". The last separator followed by one or two digits is the
 * decimal point; every other separator only groups thousands. Returns a
 * two-decimal string, or null for anything that is not an amount.
 */
export function readAmount(text: string): string | null {
  const compact = text.replace(/[\s €$£]/g, '');
  if (!/^\d[\d.,]*$/.test(compact)) return null;
  const decimal = compact.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? compact.slice(0, decimal.index) : compact).replace(
    /[.,]/g,
    '',
  );
  if (!whole) return null;
  const cents = (decimal?.[1] ?? '').padEnd(2, '0');
  return `${BigInt(whole)}.${cents}`;
}

/** Minor units for a two-decimal amount, without floating-point drift. */
export const toCents = (amount: string) => {
  const [whole = '0', fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
};

export const fromCents = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/** The decimal mark `language` writes amounts with: "," in Spanish. */
export const decimalMark = (language: Language) =>
  new Intl.NumberFormat(language)
    .formatToParts(1.5)
    .find((part) => part.type === 'decimal')?.value ?? '.';

// Spanish identity and banking data, checked the way the issuing systems check
// them. Every function takes what the owner typed and is forgiving about
// spaces, dashes, and case; none of them talks to the network.

/** Upper case, no spaces: the form IBANs are checked in. */
export function compactIban(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Groups of four, the way IBANs are printed and read aloud. */
export function formatIban(value: string) {
  return compactIban(value).replace(/(.{4})(?=.)/g, '$1 ');
}

const ibanLengths: Record<string, number> = {
  ES: 24,
  PT: 25,
  FR: 27,
  DE: 22,
  IT: 27,
  NL: 18,
  BE: 16,
  IE: 22,
  GB: 22,
  SE: 24,
  DK: 18,
  FI: 18,
  AT: 20,
  LU: 20,
  PL: 28,
  CH: 21,
};

/** ISO 13616: move the first four characters to the end, letters to numbers, remainder 1 mod 97. */
export function checkIban(
  input: string,
):
  | { kind: 'empty' }
  | { kind: 'valid'; value: string; bank: Bank | null }
  | { kind: 'incomplete'; missing: number }
  | { kind: 'invalid'; reason: string } {
  const value = compactIban(input);
  if (!value) return { kind: 'empty' };
  const country = value.slice(0, 2);
  if (!/^[A-Z]{2}\d{2}/.test(value))
    return {
      kind: 'invalid',
      reason: 'An IBAN starts with a country code and two digits.',
    };
  const length = ibanLengths[country];
  if (length && value.length < length)
    return { kind: 'incomplete', missing: length - value.length };
  if ((length && value.length !== length) || value.length > 34)
    return {
      kind: 'invalid',
      reason: 'This IBAN is too long for its country.',
    };
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  if (remainder !== 1)
    return {
      kind: 'invalid',
      reason: 'The check digits do not match. A digit may be mistyped.',
    };
  return {
    kind: 'valid',
    value: formatIban(value),
    bank: country === 'ES' ? (banks[value.slice(4, 8)] ?? null) : null,
  };
}

export type Bank = { name: string; bic: string };

// The Spanish banks most accounts are held at, by the entity code in digits
// 5–8 of the IBAN. Anything else is simply not recognised.
const banks: Record<string, Bank> = {
  '0049': { name: 'Banco Santander', bic: 'BSCHESMMXXX' },
  '0073': { name: 'Openbank', bic: 'OPENESMMXXX' },
  '0081': { name: 'Banco Sabadell', bic: 'BSABESBBXXX' },
  '0128': { name: 'Bankinter', bic: 'BKBKESMMXXX' },
  '0182': { name: 'BBVA', bic: 'BBVAESMMXXX' },
  '1465': { name: 'ING', bic: 'INGDESMMXXX' },
  '2080': { name: 'Abanca', bic: 'CAGLESMMXXX' },
  '2085': { name: 'Ibercaja', bic: 'CAZRES2ZXXX' },
  '2095': { name: 'Kutxabank', bic: 'BASKES2BXXX' },
  '2100': { name: 'CaixaBank', bic: 'CAIXESBBXXX' },
  '2103': { name: 'Unicaja', bic: 'UCJAES2MXXX' },
  '3058': { name: 'Cajamar', bic: 'CCRIES2AXXX' },
};

export function checkEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'empty' as const;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
    ? ('valid' as const)
    : ('invalid' as const);
}

// The mailbox providers most addresses end in, most common first: the first
// one that starts with what was typed after the @ is the one offered.
const mailDomains = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'yahoo.com',
  'hotmail.es',
  'yahoo.es',
  'outlook.es',
  'live.com',
  'proton.me',
  'protonmail.com',
  'me.com',
  'telefonica.net',
];

/** The full address a partly typed one most likely ends as, or null. */
export function completeEmail(value: string) {
  const at = value.indexOf('@');
  if (at < 1 || value.indexOf('@', at + 1) !== -1) return null;
  const typed = value.slice(at + 1).toLowerCase();
  if (!typed) return null;
  const domain = mailDomains.find(
    (candidate) => candidate.startsWith(typed) && candidate !== typed,
  );
  return domain ? value.slice(0, at + 1) + domain : null;
}

const misspelt: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.es': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'icloud.con': 'icloud.com',
  'iclod.com': 'icloud.com',
};

/** The address with a known domain misspelling fixed, or null if none. */
export function correctEmail(value: string) {
  const at = value.lastIndexOf('@');
  if (at < 1) return null;
  const fixed = misspelt[value.slice(at + 1).toLowerCase()];
  return fixed ? value.slice(0, at + 1) + fixed : null;
}

/** The address's own domain when it is a company's, not a mailbox provider's. */
export function ownDomain(email: string) {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain || checkEmail(email) !== 'valid') return null;
  return mailDomains.includes(domain) ? null : domain;
}

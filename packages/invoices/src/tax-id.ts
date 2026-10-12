const dniLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Upper case, no spaces, dots, or dashes: the form tax IDs are stored in. */
export function compactTaxId(value: string) {
  return value.toUpperCase().replace(/[\s.\-/]/g, '');
}

const cifKinds: Record<string, string> = {
  A: 'Sociedad anónima',
  B: 'Sociedad limitada',
  C: 'Sociedad colectiva',
  D: 'Sociedad comanditaria',
  E: 'Comunidad de bienes',
  F: 'Cooperativa',
  G: 'Asociación',
  H: 'Comunidad de propietarios',
  J: 'Sociedad civil',
  N: 'Entidad extranjera',
  P: 'Corporación local',
  Q: 'Organismo público',
  R: 'Congregación religiosa',
  S: 'Órgano de la Administración',
  U: 'Unión temporal de empresas',
  V: 'Otro tipo de entidad',
  W: 'Establecimiento permanente',
};

const regionName = (code: string) => {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
};

export type TaxIdCheck =
  | { kind: 'empty' }
  | { kind: 'valid'; label: string; value: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'foreign'; label: string; value: string };

// Naming the expected control turns "wrong" into something the owner can act
// on: if it matches their papers, the letter was the typo; if not, a digit was.
const mismatch = (body: string, expected = '?') =>
  ({
    kind: 'invalid',
    reason: `The control for ${body} is ${expected}.`,
  }) as const;

/**
 * Classifies a tax ID and checks its control character: DNI-style NIF, NIE,
 * the K/L/M NIFs, and company CIFs. A leading EU country prefix is read as a
 * VAT number; for Spain the rest is still checked, for other countries only
 * the shape is.
 */
export function checkTaxId(input: string, country = 'ES'): TaxIdCheck {
  let value = compactTaxId(input);
  if (!value) return { kind: 'empty' };
  const prefix = value.slice(0, 2);
  if (/^[A-Z]{2}$/.test(prefix) && prefix !== 'ES' && regionName(prefix)) {
    return /^[A-Z]{2}[A-Z0-9]{2,13}$/.test(value)
      ? { kind: 'foreign', label: `VAT · ${regionName(prefix)}`, value }
      : { kind: 'invalid', reason: 'This does not look like a VAT number.' };
  }
  const vat = prefix === 'ES' && value.length === 11;
  if (vat) value = value.slice(2);
  if (country !== 'ES' && !vat)
    return { kind: 'foreign', label: 'Foreign tax ID', value };
  const shown = vat ? `ES${value}` : value;

  let match = /^(\d{8})([A-Z])$/.exec(value);
  if (match) {
    const [, digits = '', letter] = match;
    const expected = dniLetters[Number(digits) % 23];
    return expected === letter
      ? { kind: 'valid', label: 'NIF · Individual', value: shown }
      : mismatch(digits, expected);
  }
  match = /^([XYZ])(\d{7})([A-Z])$/.exec(value);
  if (match) {
    const [, first = 'X', digits, letter] = match;
    const expected =
      dniLetters[Number(`${'XYZ'.indexOf(first)}${digits}`) % 23];
    return expected === letter
      ? { kind: 'valid', label: 'NIE · Foreign resident', value: shown }
      : mismatch(`${first}${digits}`, expected);
  }
  match = /^([KLM])(\d{7})([A-Z])$/.exec(value);
  if (match) {
    const [, first, digits, letter] = match;
    const expected = dniLetters[Number(digits) % 23];
    return expected === letter
      ? { kind: 'valid', label: 'NIF · Special', value: shown }
      : mismatch(`${first}${digits}`, expected);
  }
  match = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(value);
  if (match) {
    const [, first = '', digits = '', control = ''] = match;
    // Odd positions are doubled and their digits summed; even positions add
    // as they are. The control is what brings the total to a multiple of 10.
    let sum = 0;
    for (let index = 0; index < 7; index += 1) {
      const digit = Number(digits[index]);
      if (index % 2 === 0) {
        const doubled = digit * 2;
        sum += Math.floor(doubled / 10) + (doubled % 10);
      } else sum += digit;
    }
    const expected = (10 - (sum % 10)) % 10;
    const letter = 'JABCDEFGHI'[expected];
    // Some entity types must use the letter form, some the digit form.
    const ok = 'PQRSNW'.includes(first)
      ? control === letter
      : 'ABEH'.includes(first)
        ? control === String(expected)
        : control === letter || control === String(expected);
    return ok
      ? { kind: 'valid', label: `CIF · ${cifKinds[first]}`, value: shown }
      : mismatch(
          `${first}${digits}`,
          'PQRSNW'.includes(first)
            ? letter
            : 'ABEH'.includes(first)
              ? String(expected)
              : `${expected} or ${letter}`,
        );
  }
  return {
    kind: 'invalid',
    reason:
      'Spanish tax IDs are 8 digits and a letter, or a letter, 7 digits, and a control.',
  };
}

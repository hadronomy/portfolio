import type { Locale } from '#paraglide/runtime.js';

export {
  baseLocale,
  isLocale,
  type Locale,
  locales,
} from '#paraglide/runtime.js';

/** A compiled message: its inputs, and the locale it speaks when asked. */
export type Message<Inputs> = (
  inputs: Inputs,
  options?: { locale?: Locale },
) => string;

/**
 * Calls messages in one locale. Documents fix their own language, which is
 * not the visitor's, so every customer page and every PDF and email says
 * its words through one of these rather than through the request's locale.
 *
 *     const t = translate('es');
 *     t(m.quote_days_left, { count: 3 }); // "Quedan 3 días"
 */
/** A message that takes no inputs, for props that name a whole sentence. */
export type Sentence = Message<{}>;

export interface Translate {
  readonly locale: Locale;
  (message: Sentence): string;
  <Inputs>(message: Message<Inputs>, inputs: Inputs): string;
}

export function translate(locale: Locale): Translate {
  const t = <Inputs>(message: Message<Inputs>, inputs?: Inputs) =>
    message(inputs ?? ({} as Inputs), { locale });
  return Object.assign(t, { locale }) as Translate;
}

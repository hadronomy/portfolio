import { type Locale, type Translate, translate } from '@portfolio/i18n';
import { setLocale } from '@portfolio/i18n/runtime';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';

// A customer page speaks one language, chosen on the server: its document's
// when it shows one, otherwise the visitor's (see `requestLanguage`). The page
// says it once with <Speak>, and everything inside reads it with useT().

const Spoken = createContext<Locale | null>(null);

/**
 * Sets the language of everything inside. `remember` keeps it as the
 * visitor's language too, so a later page without a document, such as a
 * closed link, still speaks the language of the last document they read.
 */
export function Speak({
  locale,
  remember = false,
  children,
}: {
  locale: Locale;
  remember?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (remember) setLocale(locale, { reload: false });
  }, [locale, remember]);
  return <Spoken.Provider value={locale}>{children}</Spoken.Provider>;
}

/** The messages of the nearest <Speak>, as `t(m.key, inputs)`. */
export function useT(): Translate {
  const locale = useContext(Spoken);
  if (!locale) throw new Error('useT() needs a <Speak> above it.');
  return useMemo(() => translate(locale), [locale]);
}

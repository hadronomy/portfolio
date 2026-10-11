export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const languageNames = {
  en: 'English',
  es: 'Español',
} satisfies Record<Locale, string>;

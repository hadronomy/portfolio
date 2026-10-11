import { defineConfig } from '@inlang/paraglide-js';

// A customer page speaks its document's language, passed to each message
// as `{ locale }`. Only a page without a document falls back on these: the
// language the customer last read a document in, kept in a cookie, and
// Spanish when there is none.
export default defineConfig({
  strategy: ['cookie', 'baseLocale'],
  cookieName: 'invoices-language',
});

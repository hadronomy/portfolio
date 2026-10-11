// Settings both the server and the browser read.

/** Where better-auth answers. It sits under /invoices, so the Start app owns it next to the pages it serves. */
export const authBasePath = '/invoices/auth';

/** Signs the owner in without typing. Authorization never reads it; the owner's DID decides. */
export const ownerHandle = 'hadronomy.com';

/** The PostgreSQL schema the auth tables live in, beside the invoices'. */
export const authNamespace = 'auth';

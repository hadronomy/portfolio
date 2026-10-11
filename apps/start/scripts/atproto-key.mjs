// Prints a new ES256 signing key for AT Protocol sign-in, ready to paste into
// INVOICE_ATPROTO_KEYS. To rotate, put the new key first and keep the old one
// after it until sessions signed with it are gone.
import { JoseKey } from '@atproto/oauth-client-node';

const kid = `invoices-${new Date().toISOString().slice(0, 10)}`;
const key = await JoseKey.generate(['ES256'], kid);
console.log(`INVOICE_ATPROTO_KEYS='${JSON.stringify([key.privateJwk])}'`);

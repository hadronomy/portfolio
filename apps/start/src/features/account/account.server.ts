import type { Checkout } from '@portfolio/invoices/collection-model';
import {
  CustomerAccess,
  type CustomerInvoice,
  customerEmail,
} from '@portfolio/invoices/customer-access';
import type { InvoiceId, Language } from '@portfolio/invoices/model';
import { Effect, Option } from 'effect';
import { requireCustomer, viewer } from '../../server/auth.server';
import { customerAccounts } from '../../server/config.server';
import { Payments } from '../../server/payments.server';
import { requestLanguage } from '../../server/request.server';
import { checkout } from '../invoices/collection.server';
import { pdfResponse, unavailable } from '../invoices/operations.server';

// The customer's side of the app: the list of invoices billed to them, each
// one's page to pay it on, and its PDF. Everything here starts from the
// signed-in address and reads only what is billed to it.

/** What the account page shows. */
export type AccountPage =
  | {
      readonly _tag: 'SignedOut';
      readonly language: Language;
      /** Whether codes can be sent here at all. */
      readonly available: boolean;
    }
  | {
      readonly _tag: 'SignedIn';
      readonly language: Language;
      readonly email: string;
      readonly invoices: readonly CustomerInvoice[];
      /** Whether invoices open to be paid online, or only download. */
      readonly payments: boolean;
    }
  | { readonly _tag: 'Owner' };

export const accountPage = Effect.fn('Account.page')(function* () {
  const language = yield* requestLanguage;
  const current = yield* viewer;
  if (current?._tag === 'Owner') return { _tag: 'Owner' } satisfies AccountPage;
  if (current?._tag !== 'Customer')
    return {
      _tag: 'SignedOut',
      language,
      available: yield* customerAccounts,
    } satisfies AccountPage;
  const invoices = yield* unavailable(
    CustomerAccess.use((access) => access.invoices(current.email)),
  );
  const page: AccountPage = {
    _tag: 'SignedIn',
    // The invoices speak to the customer in their own language; the page
    // around them follows the newest one.
    language: invoices[0]?.language ?? language,
    email: current.email,
    invoices,
    payments: Option.isSome(yield* Payments),
  };
  return page;
});

/** One invoice's page in the account. */
export type AccountInvoice =
  | { readonly _tag: 'SignedOut' }
  | { readonly _tag: 'Missing'; readonly language: Language }
  | {
      readonly _tag: 'Found';
      readonly id: InvoiceId;
      readonly page: Checkout;
      readonly publishableKey: string;
    };

/** The page for one of the customer's invoices; anyone else's reads as missing. */
export const accountInvoice = Effect.fn('Account.invoice')(function* (
  id: InvoiceId,
) {
  if ((yield* viewer)?._tag !== 'Customer')
    return { _tag: 'SignedOut' } satisfies AccountInvoice;
  const found = yield* checkout({ _tag: 'Account', id });
  const result: AccountInvoice = found
    ? { _tag: 'Found', id, ...found }
    : { _tag: 'Missing', language: yield* requestLanguage };
  return result;
});

/** One of the customer's invoices as a PDF; anyone else's reads as not found. */
export const customerPdf = Effect.fn('Account.pdf')(function* (
  id: InvoiceId,
  language: Language | undefined,
) {
  const email = yield* requireCustomer;
  const invoice = yield* unavailable(
    CustomerAccess.use((access) => access.invoice(email, id)),
  );
  return yield* pdfResponse(id, language ?? invoice.data.language);
});

/**
 * Where the payment page stands on accounts, for an invoice billed to
 * `billedTo`: already in the visitor's account, offered, or not on offer.
 */
export const accountOffer = Effect.fn('Account.offer')(function* (
  billedTo: string,
) {
  if (!billedTo.trim() || !(yield* customerAccounts))
    return 'unavailable' as const;
  const current = yield* viewer;
  if (current?._tag === 'Owner') return 'unavailable' as const;
  return current?._tag === 'Customer' &&
    current.email === customerEmail(billedTo)
    ? ('signed-in' as const)
    : ('offer' as const);
});

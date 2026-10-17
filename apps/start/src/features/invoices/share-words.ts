import type { ShareFailure } from '~/features/invoices/collection.server';

// What the owner, or an agent working for them, hears when an invoice
// cannot be opened for online payment. One set of words for both.

const refusals: Record<string, string> = {
  draft: 'Issue the invoice before you share a payment link.',
  quote: 'A quote is accepted, not paid. Invoice it once it is accepted.',
  rectification: 'A rectifying invoice is settled against its original.',
  'nothing-due': 'This invoice has nothing to pay.',
  'partly-paid':
    'A payment is already recorded here. Online payment starts from an unpaid invoice.',
  paid: 'This invoice is already paid.',
  'in-review': 'Resolve the payment issue first.',
};

/** Why a payment link could not be made, in the owner's words. */
export function shareFailureMessage(failure: ShareFailure) {
  switch (failure._tag) {
    case 'Unconfigured':
      return 'Online payments are not set up.';
    case 'NotCollectible':
      return refusals[failure.reason] ?? 'This invoice cannot be paid online.';
    case 'Mismatch':
      return 'Stripe added this invoice up differently, so it was not opened for payment.';
    case 'Stripe':
      return failure.reason === 'authentication'
        ? 'Stripe refused the secret key. Check STRIPE_SECRET_KEY.'
        : 'Stripe could not be reached. Try again; nothing was charged.';
    case 'Storage':
      return 'The payment link could not be saved. Try again.';
  }
}

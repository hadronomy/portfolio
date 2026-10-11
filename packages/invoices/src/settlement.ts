import { Schema } from 'effect';
import {
  intentOfEvent,
  invoiceOfEvent,
  PaymentIntentId,
  type StripeEvent,
  StripeInvoiceId,
} from './stripe/schema';

/**
 * Work that brings one Stripe invoice's payments into the ledger. It names
 * what to look at, never what happened: settling reads Stripe's current
 * state, so a settlement run late, twice, or out of order records the same
 * thing. It is the message the payments Worker queues, so it stays small
 * and versionless: a new kind is a new case.
 */
export const Settlement = Schema.TaggedUnion({
  /** The Stripe invoice itself. */
  Invoice: { invoice: StripeInvoiceId },
  /** Whatever Stripe invoice this PaymentIntent was paid toward. */
  Intent: { intent: PaymentIntentId },
});
export type Settlement = typeof Settlement.Type;

/** The settlement a verified Stripe event calls for, or null when it calls for none. */
export function settlementOf(event: StripeEvent): Settlement | null {
  const invoice = invoiceOfEvent(event);
  if (invoice) return Settlement.cases.Invoice.make({ invoice });
  const intent = intentOfEvent(event);
  if (intent) return Settlement.cases.Intent.make({ intent });
  return null;
}

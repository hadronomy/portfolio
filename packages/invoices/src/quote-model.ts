import { Schema } from 'effect';
import { bills } from './billing';
import { type Invoice, InvoiceId, Language, RecordId } from './model';
import { PaymentPlan } from './plan';

// A quote's life after it is issued, as data: the customer's answer, and
// the invoices an accepted quote is billed in. Safe in the browser.

// The 600 × 260 pad adds 16 points of export padding on each edge.
// Keep these bounds in sync with signature-pad.tsx's field and inkBounds.
const signatureBounds = Schema.makeFilter((svg: string) => {
  const box =
    /viewBox="(-?\d+) (-?\d+) (\d+) (\d+)" width="(\d+)" height="(\d+)"/.exec(
      svg,
    );
  if (!box) return false;
  const [x, y, width, height, renderedWidth, renderedHeight] = box
    .slice(1)
    .map(Number);
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined
  )
    return false;
  if (
    x < -16 ||
    y < -16 ||
    width <= 0 ||
    height <= 0 ||
    width > 632 ||
    height > 292 ||
    x + width > 616 ||
    y + height > 276 ||
    renderedWidth !== width ||
    renderedHeight !== height
  )
    return false;
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)];
  if (paths.length > 128) return false;
  return paths.every((path) => {
    const d = path[1];
    if (!d || d.length > 65_536) return false;
    const coordinates = d.replace(/[MQZ]/g, ' ').trim().split(/ +/);
    if (coordinates.length < 6 || (coordinates.length - 2) % 4 !== 0)
      return false;
    return coordinates.every((token, index) => {
      const value = Number(token);
      return (
        /^-?\d+(?:\.\d+)?$/.test(token) &&
        Number.isFinite(value) &&
        value >= -16 &&
        value <= (index % 2 === 0 ? 616 : 276)
      );
    });
  });
});

/**
 * A drawn signature, exactly as the pad exports it: one SVG of filled
 * paths, each a closed outline of numbers in one hex colour. Nothing else
 * matches, so no script, link or style can ride in with it, wherever it is
 * shown later. Dimensions and coordinates bound the rasterizer allocation.
 */
export const Signature = Schema.String.check(
  Schema.isMaxLength(200_000),
  signatureBounds,
  Schema.isPattern(
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="-?\d+ -?\d+ \d+ \d+" width="\d+" height="\d+">(?:<path d="M[-\d. ]+Q[-\d. ]+Z" fill="#[0-9a-f]{6}"\/>)+<\/svg>$/,
  ),
);

/** A stored signature as an image source. An image never runs what it shows. */
export const signatureSource = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** An address a quote can be emailed to. */
export const EmailAddress = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
);

/** A quote emailed to its customer: to whom, and when. */
export const QuoteEmail = Schema.Struct({
  to: Schema.String,
  sentAt: Schema.String,
  /** When the link the email carries stops opening. */
  expiresAt: Schema.String,
});
export interface QuoteEmail extends Schema.Schema.Type<typeof QuoteEmail> {}

/** What the customer sends back from the quote page. */
export const Answer = Schema.Struct({
  outcome: Schema.Literals(['accepted', 'declined']),
  name: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(200)),
  earlyStart: Schema.Boolean,
  language: Language,
  digest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  /** The plan they accept under; null when the quote offers only one. */
  plan: Schema.NullOr(RecordId),
  /** The signature they drew, as SVG; an acceptance needs one. */
  signature: Schema.NullOr(Signature),
});
export interface Answer extends Schema.Schema.Type<typeof Answer> {}

/** One payment of an accepted quote, and the invoice it was billed with. */
export const Billed = Schema.Struct({
  payment: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  invoiceId: InvoiceId,
});
export interface Billed extends Schema.Schema.Type<typeof Billed> {}

/** A customer's answer to an issued quote, with the evidence of who gave it. */
export const QuoteResponse = Schema.Struct({
  quoteId: InvoiceId,
  outcome: Schema.Literals(['accepted', 'declined']),
  /** The full name the customer typed. With `signature`, their simple electronic signature. */
  name: Schema.String,
  /** The signature they drew, as SVG; null on a declined quote. */
  signature: Schema.NullOr(Schema.String),
  /** The address the quote was sent to. */
  email: Schema.String,
  /** A consumer's express request to start inside the withdrawal period. */
  earlyStart: Schema.Boolean,
  language: Language,
  /** SHA-256 of the PDF the customer read and answered. */
  digest: Schema.String,
  address: Schema.String,
  agent: Schema.String,
  decidedAt: Schema.String,
  /** When the confirmation email went out; null until it has. */
  confirmedAt: Schema.NullOr(Schema.String),
  /**
   * The plan accepted, as it stood then: later edits to the quote's plans
   * never move what the customer agreed to. Null on a declined quote.
   */
  plan: Schema.NullOr(PaymentPlan),
  /** The payments billed so far, by their place in the plan. */
  billed: Schema.Array(Billed),
});
export interface QuoteResponse
  extends Schema.Schema.Type<typeof QuoteResponse> {}

/** The day a quote was accepted, which its plan counts from. */
export const acceptedOn = (response: QuoteResponse) =>
  response.decidedAt.slice(0, 10);

/**
 * Where a quote stands: written, out for an answer, past its validity
 * unanswered, answered, or with every payment invoiced.
 */
export type QuoteState =
  | 'draft'
  | 'open'
  | 'expired'
  | 'accepted'
  | 'declined'
  | 'invoiced';

/** The state of a quote on `today`, an ISO calendar day. */
export function quoteState(
  quote: Invoice,
  response: QuoteResponse | null,
  today = new Date().toISOString().slice(0, 10),
): QuoteState {
  if (quote.status === 'draft') return 'draft';
  if (response?.outcome === 'accepted' && response.plan) {
    const due = bills(quote.data, response.plan, acceptedOn(response)).length;
    return response.billed.length >= due ? 'invoiced' : 'accepted';
  }
  if (response) return response.outcome;
  return (quote.data.quote?.validUntil ?? '') < today ? 'expired' : 'open';
}

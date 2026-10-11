import { createHash } from 'node:crypto';
import { Documents } from '@portfolio/invoices/documents';
import {
  type InvoiceId,
  type Language,
  MissingInvoice,
  type OwnerDid,
} from '@portfolio/invoices/model';
import type { Answer } from '@portfolio/invoices/quote-model';
import { type QuoteError, Quotes } from '@portfolio/invoices/quotes';
import { InvoiceStore } from '@portfolio/invoices/store';
import { getRequestIP } from '@tanstack/react-start/server';
import { Effect, Option } from 'effect';
import { requireOwner } from '../../server/auth.server';
import { Mailer } from '../../server/mail.server';
import { PageImages } from '../../server/page-images.server';
import {
  CurrentRequest,
  origin,
  Refused,
  sameOrigin,
} from '../../server/request.server';
import { pdfResponse, unavailable } from './operations.server';

// The request side of quotes: the owner sends one with a link, and the
// customer reads and answers it on the page that link opens. A link shows
// one quote and nothing else in the workspace.

/** A quote failure as the page hears it: the reason, or the store being down. */
const answered = <A, R>(effect: Effect.Effect<A, QuoteError, R>) =>
  effect.pipe(
    Effect.map((value) => ({ ok: true as const, value })),
    Effect.catchTag('QuoteClosed', (closed) =>
      Effect.succeed({ ok: false as const, reason: closed.reason }),
    ),
    unavailable,
  );

/** Mints a link to an open quote, as a URL the owner can send. */
export const sendQuote = Effect.fn('QuotesServer.send')(function* (
  id: InvoiceId,
  actor: OwnerDid,
  base: string,
) {
  const result = yield* answered(
    Quotes.use((quotes) => quotes.share(id, actor)),
  );
  return result.ok
    ? {
        ok: true as const,
        url: `${base}/invoices/quote/${result.value.token}`,
        expiresAt: result.value.expiresAt,
      }
    : result;
});

/** The owner's request to send a quote: from the invoice pages only. */
export const shareQuote = Effect.fn('QuotesServer.share')(function* (
  id: InvoiceId,
) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  return yield* sendQuote(id, actor, yield* origin);
});

/** Closes every link to the quote. */
export const revokeQuote = Effect.fn('QuotesServer.revoke')(function* (
  id: InvoiceId,
) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  return yield* unavailable(Quotes.use((quotes) => quotes.revoke(id, actor)));
});

/** How many links to the quote are open. */
export const quoteLinks = Effect.fn('QuotesServer.links')(function* (
  id: InvoiceId,
) {
  yield* requireOwner;
  return yield* unavailable(Quotes.use((quotes) => quotes.links(id)));
});

/** The quote a link opens, or none: one answer for every bad token. */
const byLink = (token: string) =>
  Quotes.use((quotes) => quotes.resolve(token)).pipe(
    Effect.map(Option.some),
    Effect.catchTags({
      LinkInvalid: () => Effect.succeedNone,
      QuoteClosed: () => Effect.succeedNone,
    }),
    unavailable,
  );

/** A resolved quote's view. It is a quote by now; failing that, it is missing. */
const viewOf = (id: InvoiceId) =>
  Quotes.use((quotes) => quotes.view(id)).pipe(
    Effect.catchTag('QuoteClosed', () =>
      Effect.fail(new MissingInvoice({ id })),
    ),
    unavailable,
  );

/** The quote's PDF in `language`, with the digest an answer names. */
const pdfOf = (id: InvoiceId, language: Language) =>
  unavailable(Documents.use((documents) => documents.pdf(id, language))).pipe(
    Effect.map(({ bytes }) => ({
      bytes,
      digest: createHash('sha256').update(bytes).digest('hex'),
    })),
  );

/** What the customer's page shows, or null when the link does not open. */
export const quotePage = Effect.fn('QuotesServer.page')(function* (
  token: string,
) {
  const id = yield* byLink(token);
  if (Option.isNone(id)) return null;
  const view = yield* viewOf(id.value);
  const { plans } = yield* unavailable(
    InvoiceStore.use((store) => store.offer(id.value)),
  );
  const pdf = yield* pdfOf(id.value, view.quote.data.language);
  const sheets = yield* PageImages.use((images) => images.sheets(pdf));
  return {
    quote: view.quote,
    response: view.response,
    state: view.state,
    digests: view.digests,
    plans,
    sheets: { ...sheets, digest: pdf.digest },
  };
});

/** The evidence a request carries: the network address and the browser. */
const evidence = Effect.gen(function* () {
  const request = yield* CurrentRequest;
  // A Web Request carries no peer address; the server's own request
  // context does. Behind a proxy the client is the first forwarded hop.
  const address = yield* Effect.sync(
    () => getRequestIP({ xForwardedFor: true }) ?? '',
  );
  return {
    address: address.split(',')[0]?.trim() ?? '',
    agent: request.headers.get('user-agent') ?? '',
  };
});

/**
 * Records the customer's answer, then mails them the confirmation and the
 * owner a copy. A mail failure leaves the answer standing, unconfirmed, for
 * the owner to follow up.
 */
export const answerQuote = Effect.fn('QuotesServer.answer')(function* (
  token: string,
  answer: Answer,
) {
  yield* sameOrigin;
  const id = yield* byLink(token);
  if (Option.isNone(id))
    return yield* new Refused({ status: 404, message: 'This link is closed.' });
  const result = yield* answered(
    Quotes.use((quotes) =>
      Effect.flatMap(evidence, (seen) =>
        quotes.respond(id.value, answer, seen),
      ),
    ),
  );
  if (!result.ok) return result;
  const response = result.value;
  if (!response.confirmedAt) {
    const view = yield* viewOf(id.value);
    const base = yield* origin;
    const sent = yield* Mailer.use((mailer) =>
      mailer.quoteAnswer({
        to: response.email,
        copy: view.quote.data.issuer.email,
        language: response.language,
        outcome: response.outcome,
        number: view.quote.number ?? '',
        issuer: view.quote.data.issuer.name,
        name: response.name,
        decidedAt: response.decidedAt.slice(0, 16).replace('T', ' '),
        digest: response.digest,
        earlyStart: response.earlyStart,
        url: `${base}/invoices/quote/${token}`,
      }),
    ).pipe(
      Effect.as(true),
      Effect.catchTag('MailFailure', (failure) =>
        Effect.logWarning('Quote confirmation not sent', failure.message).pipe(
          Effect.as(false),
        ),
      ),
    );
    if (sent)
      yield* unavailable(Quotes.use((quotes) => quotes.confirmed(id.value)));
  }
  return { ok: true as const, response };
});

/**
 * One page of the quote's PDF as an image, for whoever holds its link. The
 * address names the digest of the PDF it shows, so the image never changes
 * at that address: a newer PDF is a different address, and the old one is
 * gone rather than showing pages the answer would not cover.
 */
export const quotePageImage = Effect.fn('QuotesServer.pageImage')(function* (
  token: string,
  language: Language,
  digest: string,
  page: number,
) {
  const id = yield* byLink(token);
  if (Option.isNone(id))
    return yield* new Refused({ status: 404, message: 'This link is closed.' });
  const pdf = yield* pdfOf(id.value, language);
  const image =
    pdf.digest === digest
      ? yield* PageImages.use((images) => images.page(pdf, page - 1))
      : null;
  if (!image)
    return yield* new Refused({ status: 404, message: 'No such page.' });
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/** The quote's PDF for whoever holds its link. */
export const quotePdf = Effect.fn('QuotesServer.pdf')(function* (
  token: string,
  language: Language,
) {
  const id = yield* byLink(token);
  if (Option.isNone(id))
    return yield* new Refused({ status: 404, message: 'This link is closed.' });
  return yield* pdfResponse(id.value, language);
});

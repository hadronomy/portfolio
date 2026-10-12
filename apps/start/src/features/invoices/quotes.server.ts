import { createHash } from 'node:crypto';
import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
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
import { invitationEmail, Mailer } from '../../server/mail.server';
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

/** What the owner asks for when emailing a quote. */
export interface QuoteEmailRequest {
  readonly to: string;
  /** A few words of their own, or empty. */
  readonly note: string;
  /** Whether they get a copy themselves. */
  readonly copy: boolean;
}

/**
 * Emails an open quote to `to` with a link minted for it and its PDF
 * attached, then records that it went. The owner's pages and agents both
 * send through here. A mail failure leaves nothing recorded; the link it
 * minted was never seen, so it opens for no one.
 */
export const emailQuoteTo = Effect.fn('QuotesServer.emailTo')(function* (
  id: InvoiceId,
  actor: OwnerDid,
  base: string,
  request: QuoteEmailRequest,
) {
  const shared = yield* sendQuote(id, actor, base);
  if (!shared.ok) return shared;
  const view = yield* viewOf(id);
  const { bytes } = yield* pdfOf(id, view.quote.data.language);
  const sent = yield* Mailer.use((mailer) =>
    mailer.quoteInvitation({
      quote: view.quote,
      to: request.to,
      note: request.note,
      url: shared.url,
      copy: request.copy ? view.quote.data.issuer.email || null : null,
      pdf: bytes,
    }),
  ).pipe(
    Effect.as(true),
    Effect.catchTag('MailFailure', (failure) =>
      Effect.logWarning('Quote email not sent', failure.message).pipe(
        Effect.as(false),
      ),
    ),
  );
  if (!sent) return { ok: false as const, reason: 'mail' as const };
  const email = {
    to: request.to,
    sentAt: new Date().toISOString(),
    expiresAt: shared.expiresAt,
  };
  yield* unavailable(Quotes.use((quotes) => quotes.emailed(id, actor, email)));
  return { ok: true as const, ...email };
});

/** The owner's request to email a quote: from the invoice pages only. */
export const emailQuote = Effect.fn('QuotesServer.email')(function* (
  id: InvoiceId,
  request: QuoteEmailRequest,
) {
  yield* sameOrigin;
  const actor = yield* requireOwner;
  return yield* emailQuoteTo(id, actor, yield* origin, request);
});

/**
 * The email the owner is about to send, exactly as it will go out, for
 * the compose dialog. Its link is a stand-in: no link is minted until the
 * owner sends.
 */
export const quoteEmailPreview = Effect.fn('QuotesServer.emailPreview')(
  function* (id: InvoiceId, note: string) {
    yield* requireOwner;
    const view = yield* viewOf(id);
    const base = yield* origin;
    const email = yield* invitationEmail({
      quote: view.quote,
      to: view.quote.data.customer.email,
      note,
      url: `${base}/invoices/quote/preview`,
    });
    return {
      subject: email.subject,
      html: email.html,
      language: view.quote.data.language,
    };
  },
);

/** Every time the quote was emailed, newest first. */
export const quoteEmails = Effect.fn('QuotesServer.emails')(function* (
  id: InvoiceId,
) {
  yield* requireOwner;
  return yield* unavailable(Quotes.use((quotes) => quotes.emails(id)));
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
 * An accepted quote's signed copy: the PDF the customer accepted, with the
 * page that records their acceptance and signature. None for a quote that
 * is not accepted.
 */
const signedCopy = (id: InvoiceId) =>
  Effect.gen(function* () {
    const view = yield* viewOf(id);
    const response = view.response;
    if (response?.outcome !== 'accepted') return null;
    const bytes = yield* unavailable(
      Documents.use((documents) => documents.signed(view.quote, response)).pipe(
        Effect.catchTag('AcceptedPdfMismatch', () => Effect.succeed(null)),
      ),
    );
    if (!bytes)
      return yield* new Refused({
        status: 409,
        message: 'The stored PDF does not match the accepted digest.',
      });
    return { quote: view.quote, response, bytes };
  });

/**
 * Records the customer's answer, then mails them the confirmation and the
 * owner a notice, with the signed copy on an acceptance. A mail failure
 * leaves the answer standing, unconfirmed, for the owner to follow up.
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
    const signed = yield* signedCopy(id.value);
    const sent = yield* Mailer.use((mailer) =>
      mailer.quoteAnswer({
        quote: view.quote,
        response,
        url: `${base}/invoices/quote/${token}`,
        workspaceUrl: `${base}/invoices/${id.value}`,
        signedCopy: signed?.bytes ?? null,
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

/**
 * The quote's PDF for whoever holds its link. Once accepted, the link
 * serves the signed copy instead: the same document, signed.
 */
export const quotePdf = Effect.fn('QuotesServer.pdf')(function* (
  token: string,
  language: Language,
) {
  const id = yield* byLink(token);
  if (Option.isNone(id))
    return yield* new Refused({ status: 404, message: 'This link is closed.' });
  const signed = yield* signedCopy(id.value);
  if (!signed) return yield* pdfResponse(id.value, language);
  const name = translate(signed.response.language)(m.accept_file, {
    number: signed.quote.number ?? '',
  });
  return new Response(new Uint8Array(signed.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

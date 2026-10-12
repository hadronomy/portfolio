import { CountryCode } from '@portfolio/invoices/address';
import { AttemptId } from '@portfolio/invoices/collection-model';
import {
  CatalogItem,
  Customer,
  DecimalText,
  Invoice,
  InvoiceId,
  Payment,
  Preferences,
  RecordId,
} from '@portfolio/invoices/model';
import { Offer, PlanLibrary } from '@portfolio/invoices/plan';
import { Answer, EmailAddress } from '@portfolio/invoices/quote-model';
import { createServerFn } from '@tanstack/react-start';
import { Effect, Result, Schema } from 'effect';
import { Auth, requireOwner, viewer } from '../../server/auth.server';
import { AppConfig } from '../../server/config.server';
import { Geocoder } from '../../server/geocoder.server';
import { agentOrigin } from '../../server/origin.server';
import { requestLanguage, sameOrigin } from '../../server/request.server';
import { serve } from '../../server/runtime.server';
import { accountOffer } from '../account/account.server';
import { agentResource } from '../auth/shared';
import {
  checkout,
  collectionStatus,
  revoke,
  share,
  startPayment,
} from './collection.server';
import { mutate, preview, workspace } from './operations.server';
import {
  answerQuote,
  emailQuote,
  quoteEmailPreview,
  quoteEmails,
  quoteLinks,
  quotePage,
  revokeQuote,
  shareQuote,
} from './quotes.server';

export const SaveMutation = Schema.Struct({
  action: Schema.Literal('save'),
  invoice: Invoice,
});
export const IssueMutation = Schema.Struct({
  action: Schema.Literal('issue'),
  id: InvoiceId,
  revision: Schema.Number,
  key: Schema.String,
});
export const RemoveMutation = Schema.Struct({
  action: Schema.Literal('remove'),
  id: InvoiceId,
});
export const RectifyMutation = Schema.Struct({
  action: Schema.Literal('rectify'),
  id: InvoiceId,
});
export const CustomerMutation = Schema.Struct({
  action: Schema.Literal('customer'),
  customer: Customer,
});
export const ItemMutation = Schema.Struct({
  action: Schema.Literal('item'),
  item: CatalogItem,
});
export const PreferencesMutation = Schema.Struct({
  action: Schema.Literal('preferences'),
  preferences: Preferences,
});
export const ForgetMutation = Schema.Struct({
  action: Schema.Literal('forget'),
  kind: Schema.Literals(['customer', 'item']),
  id: RecordId,
});
export const PaymentMutation = Schema.Struct({
  action: Schema.Literal('payment'),
  payment: Payment,
});
export const ReversePaymentMutation = Schema.Struct({
  action: Schema.Literal('reverse-payment'),
  id: RecordId,
});
/** Replaces the plans an invoice offers; null drops its own. */
export const OfferMutation = Schema.Struct({
  action: Schema.Literal('offer'),
  id: InvoiceId,
  plans: Schema.NullOr(Offer),
});
/** Sets the plan the customer pays under, as the owner agreed it with them. */
export const ChooseMutation = Schema.Struct({
  action: Schema.Literal('choose'),
  id: InvoiceId,
  plan: Schema.NullOr(RecordId),
});
export const LibraryMutation = Schema.Struct({
  action: Schema.Literal('library'),
  library: PlanLibrary,
});
/** Starts a new draft quote from an issued one. */
export const ReviseMutation = Schema.Struct({
  action: Schema.Literal('revise'),
  id: InvoiceId,
});
/** Drafts the invoice for one payment of an accepted quote's plan. */
export const BillMutation = Schema.Struct({
  action: Schema.Literal('bill'),
  id: InvoiceId,
  payment: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export const Mutation = Schema.Union([
  SaveMutation,
  IssueMutation,
  RemoveMutation,
  RectifyMutation,
  CustomerMutation,
  ItemMutation,
  PreferencesMutation,
  ForgetMutation,
  PaymentMutation,
  ReversePaymentMutation,
  OfferMutation,
  ChooseMutation,
  LibraryMutation,
  ReviseMutation,
  BillMutation,
]);
export type Mutation = typeof Mutation.Type;

// Single decode path for server-function validators: the Schema is the type,
// the decoder, and the wire entry, so validators never triplicate it.
const decodeWith =
  <S extends Schema.ConstraintDecoder<unknown>>(schema: S, message: string) =>
  (input: unknown): S['Type'] => {
    const decoded = Schema.decodeUnknownResult(schema)(input);
    if (Result.isFailure(decoded)) throw new Response(message, { status: 400 });
    return decoded.success;
  };

const decodeMutation = decodeWith(Mutation, 'Invalid invoice request.');

export const AddressSearch = Schema.Struct({
  query: Schema.String.check(Schema.isMaxLength(200)),
  country: CountryCode,
});
export const PostalLookup = Schema.Struct({
  postalCode: Schema.String.check(Schema.isMaxLength(20)),
  country: CountryCode,
});
const decodeAddressSearch = decodeWith(
  AddressSearch,
  'Invalid address search.',
);
const decodePostalLookup = decodeWith(PostalLookup, 'Invalid postal code.');

const decodeInvoiceInput = decodeWith(Invoice, 'Invalid invoice.');

export const InvoiceRef = Schema.Struct({ id: InvoiceId });
const decodeInvoiceRef = decodeWith(InvoiceRef, 'Invalid invoice.');
// The token's own shape is checked where it is resolved; here only its size.
export const LinkRef = Schema.Struct({
  token: Schema.String.check(Schema.isMaxLength(64)),
});
const decodeLinkRef = decodeWith(LinkRef, 'Invalid link.');
/** How the customer's page reached the invoice; see `Access` in collection.server. */
export const Access = Schema.TaggedUnion({
  Link: { token: LinkRef.fields.token },
  Account: { id: InvoiceId },
});
export type Access = typeof Access.Type;
export const PaymentRequest = Schema.Struct({
  access: Access,
  amount: DecimalText,
  attempt: AttemptId,
  plan: RecordId,
});
const decodePaymentRequest = decodeWith(PaymentRequest, 'Invalid payment.');
export const QuoteAnswer = Schema.Struct({
  token: LinkRef.fields.token,
  answer: Answer,
});
const decodeQuoteAnswer = decodeWith(QuoteAnswer, 'Invalid answer.');

// Client/server seam: the build replaces each handler body with an RPC stub
// in client bundles, so statically importing *.server modules here is safe
// and preferred over dynamic import. Mutation is the single source of truth
// for actions; operations.server handles each arm exhaustively.
export const getViewer = createServerFn({ method: 'GET' }).handler(() =>
  serve(viewer),
);
export const getWorkspace = createServerFn({ method: 'GET' }).handler(() =>
  serve(workspace()),
);
export const mutateWorkspace = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeMutation(input))
  .handler(({ data }) => serve(mutate(data)));
export const previewInvoice = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceInput(input))
  .handler(({ data }) => serve(preview(data)));
export const findAddresses = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeAddressSearch(input))
  .handler(({ data }) =>
    serve(
      requireOwner.pipe(
        Effect.andThen(
          Geocoder.use((geocoder) => geocoder.search(data.query, data.country)),
        ),
      ),
    ),
  );
export const findLocality = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodePostalLookup(input))
  .handler(({ data }) =>
    serve(
      requireOwner.pipe(
        Effect.andThen(
          Geocoder.use((geocoder) =>
            geocoder.locality(data.postalCode, data.country),
          ),
        ),
      ),
    ),
  );
export const getCollection = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(collectionStatus(data.id)));
export const sharePaymentLink = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(share(data.id)));
export const revokePaymentLinks = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(revoke(data.id)));
export const beginPayment = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodePaymentRequest(input))
  .handler(({ data }) => serve(startPayment(data)));
export const getCheckout = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeLinkRef(input))
  .handler(({ data }) =>
    serve(
      Effect.gen(function* () {
        const found = yield* checkout({ _tag: 'Link', token: data.token });
        if (!found)
          return { _tag: 'Closed' as const, language: yield* requestLanguage };
        return {
          _tag: 'Open' as const,
          ...found,
          account: yield* accountOffer(found.page.invoice.customerEmail),
        };
      }),
    ),
  );
export const shareQuoteLink = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(shareQuote(data.id)));
export const revokeQuoteLinks = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(revokeQuote(data.id)));
/** The owner's words in a quote email are kept short: a greeting and a line or two. */
export const quoteNoteLimit = 1000;
const decodeQuoteEmail = decodeWith(
  Schema.Struct({
    id: InvoiceId,
    to: EmailAddress,
    note: Schema.String.check(Schema.isMaxLength(quoteNoteLimit)),
    copy: Schema.Boolean,
  }),
  'Enter a valid email address.',
);
const decodeQuoteNote = decodeWith(
  Schema.Struct({
    id: InvoiceId,
    note: Schema.String.check(Schema.isMaxLength(quoteNoteLimit)),
  }),
  'Invalid note.',
);
export const emailQuoteLink = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeQuoteEmail(input))
  .handler(({ data: { id, ...request } }) => serve(emailQuote(id, request)));
export const previewQuoteEmail = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeQuoteNote(input))
  .handler(({ data }) => serve(quoteEmailPreview(data.id, data.note)));
export const getQuoteEmails = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(quoteEmails(data.id)));
export const getQuoteLinks = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeInvoiceRef(input))
  .handler(({ data }) => serve(quoteLinks(data.id)));
export const getQuotePage = createServerFn({ method: 'GET' })
  .validator((input: unknown) => decodeLinkRef(input))
  .handler(({ data }) =>
    serve(
      Effect.gen(function* () {
        const page = yield* quotePage(data.token);
        return page
          ? { _tag: 'Open' as const, ...page }
          : { _tag: 'Closed' as const, language: yield* requestLanguage };
      }),
    ),
  );
export const answerQuoteLink = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeQuoteAnswer(input))
  .handler(({ data }) => serve(answerQuote(data.token, data.answer)));

const decodeClientRef = decodeWith(
  Schema.Struct({ clientId: Schema.String.check(Schema.isMaxLength(200)) }),
  'Invalid agent.',
);
/** The agents the owner let in, and the address agents connect to. */
export const getAgents = createServerFn({ method: 'GET' }).handler(() =>
  serve(
    Effect.gen(function* () {
      yield* requireOwner;
      const settings = yield* AppConfig;
      return {
        endpoint: agentResource(
          agentOrigin({
            configured: settings.origin,
            production: settings.production,
          }),
        ),
        agents: yield* Auth.use((auth) => auth.agents()),
      };
    }),
  ),
);
export const disconnectAgent = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeClientRef(input))
  .handler(({ data }) =>
    serve(
      Effect.gen(function* () {
        yield* sameOrigin;
        yield* requireOwner;
        yield* Auth.use((auth) => auth.disconnect(data.clientId));
      }),
    ),
  );

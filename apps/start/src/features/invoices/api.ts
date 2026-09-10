import {
  CatalogItem,
  Customer,
  Invoice,
  InvoiceId,
  Payment,
  Preferences,
  RecordId,
} from '@portfolio/invoices/model';
import { createServerFn } from '@tanstack/react-start';
import { Result, Schema } from 'effect';
import { identity, signIn, signOut } from './auth.server';
import { mutate, preview, workspace } from './operations.server';

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

const decodeInvoiceInput = decodeWith(Invoice, 'Invalid invoice.');

// Client/server seam: the build replaces each handler body with an RPC stub
// in client bundles, so statically importing *.server modules here is safe
// and preferred over dynamic import. Mutation is the single source of truth
// for actions; operations.server handles each arm exhaustively.
export const getIdentity = createServerFn({ method: 'GET' }).handler(async () =>
  identity(),
);
export const beginSignIn = createServerFn({ method: 'POST' }).handler(
  async () => signIn(),
);
export const endSignIn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await signOut();
  },
);
export const getWorkspace = createServerFn({ method: 'GET' }).handler(
  async () => workspace(),
);
export const mutateWorkspace = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeMutation(input))
  .handler(async ({ data }) => mutate(data));
export const previewInvoice = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeInvoiceInput(input))
  .handler(async ({ data }) => preview(data));

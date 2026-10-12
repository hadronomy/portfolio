import { Schema } from 'effect';
import { InvoiceId, Language } from './model';

export const MailKind = Schema.Literals([
  'quote-invitation',
  'quote-copy',
  'quote-answer',
  'quote-answered',
  'sign-in-code',
]);
export type MailKind = typeof MailKind.Type;

export const MailPayload = Schema.TaggedUnion({
  Invitation: {
    url: Schema.String,
    note: Schema.String,
    expiresAt: Schema.String,
    actor: Schema.String,
  },
  Answer: { url: Schema.String, workspaceUrl: Schema.String },
  Code: { code: Schema.String, language: Language, accountUrl: Schema.String },
});
export type MailPayload = typeof MailPayload.Type;

/** Prepared before the first provider request, so a template change cannot alter an idempotent retry. */
export const PreparedMail = Schema.Struct({
  from: Schema.String,
  subject: Schema.String,
  html: Schema.String,
  text: Schema.String,
  replyTo: Schema.optional(Schema.String),
  attachments: Schema.Array(
    Schema.Struct({
      filename: Schema.String,
      content: Schema.String,
      contentType: Schema.String,
      contentId: Schema.optional(Schema.String),
    }),
  ),
});
export type PreparedMail = typeof PreparedMail.Type;

/** Delivery means the provider accepted the email. It does not prove receipt in an inbox. */
export const MailDelivery = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  invoiceId: Schema.NullOr(InvoiceId),
  kind: MailKind,
  recipient: Schema.String,
  state: Schema.Literals(['pending', 'sent', 'failed']),
  attempts: Schema.Int,
  nextAttemptAt: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  messageId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  sentAt: Schema.NullOr(Schema.String),
});
export type MailDelivery = typeof MailDelivery.Type;

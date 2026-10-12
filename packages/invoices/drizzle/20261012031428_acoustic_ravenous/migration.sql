CREATE TABLE "invoices"."mail_outbox" (
	"id" uuid PRIMARY KEY,
	"invoice_id" uuid,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"payload" jsonb NOT NULL,
	"prepared" jsonb,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"claim_token" uuid,
	"uncertain" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"message_id" text UNIQUE,
	"idempotency_key" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "mail_outbox_state_known" CHECK ("state" in ('pending', 'sent', 'failed')),
	CONSTRAINT "mail_outbox_attempts_positive" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "mail_outbox_due" ON "invoices"."mail_outbox" ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "mail_outbox_invoice" ON "invoices"."mail_outbox" ("invoice_id","created_at");--> statement-breakpoint
ALTER TABLE "invoices"."mail_outbox" ADD CONSTRAINT "mail_outbox_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");
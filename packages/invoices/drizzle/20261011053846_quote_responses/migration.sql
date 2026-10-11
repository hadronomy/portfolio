CREATE TABLE "invoices"."responses" (
	"quote_id" uuid PRIMARY KEY,
	"outcome" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"early_start" boolean NOT NULL,
	"language" text NOT NULL,
	"digest" text NOT NULL,
	"address" text NOT NULL,
	"agent" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"invoice_id" uuid UNIQUE,
	CONSTRAINT "responses_outcome_known" CHECK ("outcome" in ('accepted', 'declined')),
	CONSTRAINT "responses_early_start_accepted" CHECK (not "early_start" or "outcome" = 'accepted')
);
--> statement-breakpoint
ALTER TABLE "invoices"."responses" ADD CONSTRAINT "responses_quote_id_invoices_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "invoices"."invoices"("id");--> statement-breakpoint
ALTER TABLE "invoices"."responses" ADD CONSTRAINT "responses_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");
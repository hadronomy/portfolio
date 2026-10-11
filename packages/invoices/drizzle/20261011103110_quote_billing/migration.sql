CREATE TABLE "invoices"."billed" (
	"quote_id" uuid,
	"payment" integer,
	"invoice_id" uuid NOT NULL UNIQUE,
	CONSTRAINT "billed_pkey" PRIMARY KEY("quote_id","payment")
);
--> statement-breakpoint
ALTER TABLE "invoices"."responses" DROP CONSTRAINT "responses_invoice_id_invoices_id_fkey";--> statement-breakpoint
ALTER TABLE "invoices"."responses" DROP CONSTRAINT "responses_invoice_id_key";--> statement-breakpoint
ALTER TABLE "invoices"."responses" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "invoices"."responses" DROP COLUMN "invoice_id";--> statement-breakpoint
ALTER TABLE "invoices"."billed" ADD CONSTRAINT "billed_quote_id_invoices_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "invoices"."invoices"("id");--> statement-breakpoint
ALTER TABLE "invoices"."billed" ADD CONSTRAINT "billed_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");
CREATE TABLE "invoices"."offers" (
	"invoice_id" uuid PRIMARY KEY,
	"plans" jsonb NOT NULL,
	"chosen" uuid,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP TABLE "invoices"."plans";--> statement-breakpoint
ALTER TABLE "invoices"."offers" ADD CONSTRAINT "offers_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id") ON DELETE CASCADE;
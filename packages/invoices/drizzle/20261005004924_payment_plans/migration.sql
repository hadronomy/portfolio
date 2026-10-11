CREATE TABLE "invoices"."plans" (
	"invoice_id" uuid PRIMARY KEY,
	"plan" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices"."links" DROP COLUMN "partial";--> statement-breakpoint
ALTER TABLE "invoices"."plans" ADD CONSTRAINT "plans_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id") ON DELETE CASCADE;
CREATE SCHEMA "invoices";
--> statement-breakpoint
CREATE TABLE "invoices"."artifacts" (
	"key" text PRIMARY KEY,
	"invoice_id" uuid NOT NULL,
	"language" text NOT NULL,
	"digest" text NOT NULL,
	"bytes" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."audit" (
	"id" uuid PRIMARY KEY,
	"invoice_id" uuid,
	"operation" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."collections" (
	"invoice_id" uuid PRIMARY KEY,
	"customer_key" text NOT NULL,
	"stripe_customer" text,
	"stripe_invoice" text UNIQUE,
	"state" text NOT NULL,
	"review" jsonb,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "collections_state_known" CHECK ("state" in ('preparing', 'open', 'paid', 'review'))
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoices" (
	"id" uuid PRIMARY KEY,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"number" text UNIQUE,
	"issue_key" text UNIQUE,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invoices_revision_positive" CHECK ("revision" > 0),
	CONSTRAINT "invoices_status_known" CHECK ("status" in ('draft', 'issued'))
);
--> statement-breakpoint
CREATE TABLE "invoices"."links" (
	"token_hash" text PRIMARY KEY,
	"invoice_id" uuid NOT NULL,
	"partial" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."records" (
	"key" text PRIMARY KEY,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."sequences" (
	"key" text PRIMARY KEY,
	"value" integer NOT NULL,
	"last_date" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_invoice" ON "invoices"."audit" ("invoice_id","created_at");--> statement-breakpoint
CREATE INDEX "collections_customer" ON "invoices"."collections" ("customer_key");--> statement-breakpoint
CREATE INDEX "links_invoice" ON "invoices"."links" ("invoice_id");--> statement-breakpoint
CREATE INDEX "records_kind" ON "invoices"."records" ("kind");--> statement-breakpoint
ALTER TABLE "invoices"."artifacts" ADD CONSTRAINT "artifacts_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");--> statement-breakpoint
ALTER TABLE "invoices"."collections" ADD CONSTRAINT "collections_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");--> statement-breakpoint
ALTER TABLE "invoices"."links" ADD CONSTRAINT "links_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoices"("id");
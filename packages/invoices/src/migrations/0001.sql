CREATE TABLE IF NOT EXISTS invoices (
 id uuid PRIMARY KEY, revision integer NOT NULL CHECK(revision > 0),
 status text NOT NULL CHECK(status IN ('draft', 'issued')), number text UNIQUE, issue_key text UNIQUE,
 payload jsonb NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_sequences (key text PRIMARY KEY, value integer NOT NULL, last_date text NOT NULL);
CREATE TABLE IF NOT EXISTS invoice_records (key text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS invoice_artifacts (
 key text PRIMARY KEY, invoice_id uuid NOT NULL REFERENCES invoices(id), language text NOT NULL,
 digest text NOT NULL, bytes text NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_audit (
 id uuid PRIMARY KEY, invoice_id uuid, operation text NOT NULL, actor text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_sessions (key text PRIMARY KEY, payload jsonb NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS invoice_records_kind ON invoice_records(kind);
CREATE INDEX IF NOT EXISTS invoice_audit_invoice ON invoice_audit(invoice_id, created_at);

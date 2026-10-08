-- PAY-198: invoice numbers are sequential per organization.

CREATE TABLE invoice_sequences (
  organization_id text PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  prefix          text    NOT NULL DEFAULT 'INV-',
  padding         integer NOT NULL DEFAULT 4 CHECK (padding BETWEEN 1 AND 10),
  value           bigint  NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Continue each organization's numbering from its highest existing invoice.
INSERT INTO invoice_sequences (organization_id, value)
SELECT
  organization_id,
  max(substring(number FROM '[0-9]+$')::bigint)
FROM invoices
WHERE number ~ '[0-9]+$'
GROUP BY organization_id;

-- Organizations without invoices start at zero.
INSERT INTO invoice_sequences (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

CREATE UNIQUE INDEX invoices_organization_number_key
  ON invoices (organization_id, number);

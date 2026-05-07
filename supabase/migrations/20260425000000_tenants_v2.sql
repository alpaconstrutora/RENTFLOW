-- Tenants v2: structured address + personal details
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS type               text    DEFAULT 'individual' CHECK (type IN ('individual', 'company')),
  ADD COLUMN IF NOT EXISTS birth_date         date,
  ADD COLUMN IF NOT EXISTS marital_status     text    CHECK (marital_status IN ('single','married','divorced','widowed','other')),
  ADD COLUMN IF NOT EXISTS profession         text,
  ADD COLUMN IF NOT EXISTS rg                 text,
  ADD COLUMN IF NOT EXISTS nationality        text,
  ADD COLUMN IF NOT EXISTS monthly_income     numeric(12,2),
  ADD COLUMN IF NOT EXISTS zip_code           text,
  ADD COLUMN IF NOT EXISTS street             text,
  ADD COLUMN IF NOT EXISTS street_number      text,
  ADD COLUMN IF NOT EXISTS district           text,
  ADD COLUMN IF NOT EXISTS city               text,
  ADD COLUMN IF NOT EXISTS state              text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS photo_url          text,
  ADD COLUMN IF NOT EXISTS address            text;

-- unique CPF/CNPJ per user (allow null so existing rows don't break)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_user_document_unique
  ON tenants (user_id, document)
  WHERE document IS NOT NULL;

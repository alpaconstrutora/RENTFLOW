-- Remove campos de contato de emergência — desnecessário para o produto
ALTER TABLE tenants
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone;

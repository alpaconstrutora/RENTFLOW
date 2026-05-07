-- Tenants Sprint 3: emergency contact + notes
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS notes                   text;

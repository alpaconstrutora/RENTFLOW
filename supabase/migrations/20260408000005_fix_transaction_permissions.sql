-- BUG: ON CONFLICT requires SELECT permission on the columns involved in the constraint
-- Since SELECT on transactions was fully revoked from authenticated in schema.sql, 
-- functions like generate_monthly_rents and backfill_lease_history fail with "permission denied"
GRANT SELECT (lease_id, billing_month, is_auto_generated) ON transactions TO authenticated;

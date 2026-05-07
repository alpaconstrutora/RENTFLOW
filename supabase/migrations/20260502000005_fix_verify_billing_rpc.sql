-- Corrige verify_monthly_billing: coluna correta é tenants.name (não full_name/legal_name)
CREATE OR REPLACE FUNCTION verify_monthly_billing(
  p_month date DEFAULT DATE_TRUNC('month', CURRENT_DATE)::date
)
RETURNS TABLE (
  lease_id         uuid,
  property_name    text,
  tenant_name      text,
  rent_value       numeric,
  billing_start    date,
  has_transaction  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    l.id,
    p.name,
    COALESCE(t.name, 'Sem inquilino') AS tenant_name,
    l.rent_value,
    COALESCE(l.billing_start_date, l.start_date)::date AS billing_start,
    EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.lease_id = l.id
        AND DATE_TRUNC('month', tx.billing_month) = DATE_TRUNC('month', p_month)
    ) AS has_transaction
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  LEFT JOIN tenants t ON t.id = l.tenant_id
  WHERE l.active = true
    AND l.user_id = auth.uid()
    AND COALESCE(l.billing_start_date, l.start_date) <= p_month
  ORDER BY has_transaction, p.name;
$$;

GRANT EXECUTE ON FUNCTION verify_monthly_billing(date) TO authenticated;

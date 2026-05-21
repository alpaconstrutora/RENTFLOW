-- Fix backfill_lease_history: auth.uid() é NULL em Server Actions do Next.js
-- Solução definitiva: recebe p_user_id explícito (obtido via supabase.auth.getUser() no TS)
-- e valida ownership sem depender de auth.uid().

CREATE OR REPLACE FUNCTION backfill_lease_history(p_lease_id uuid, p_user_id uuid)
RETURNS int LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  -- Valida ownership usando p_user_id explícito (não auth.uid())
  IF NOT EXISTS (
    SELECT 1 FROM leases WHERE id = p_lease_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado ou acesso negado.';
  END IF;

  INSERT INTO transactions (
    user_id, lease_id, property_id, type, amount,
    billing_month, due_date, status, is_auto_generated
  )
  SELECT
    l.user_id, l.id, l.property_id, 'income', l.rent_value,
    ref_month,
    MAKE_DATE(
      EXTRACT(YEAR  FROM ref_month)::int,
      EXTRACT(MONTH FROM ref_month)::int,
      LEAST(l.due_day, EXTRACT(DAY FROM
        DATE_TRUNC('month', ref_month) + INTERVAL '1 month - 1 day')::int)
    ),
    'pending', true
  FROM leases l
  CROSS JOIN generate_series(
    DATE_TRUNC('month', COALESCE(l.billing_start_date, l.start_date)),
    DATE_TRUNC('month', user_today(l.user_id)) - INTERVAL '1 month',
    '1 month'
  ) AS ref_month
  WHERE l.id = p_lease_id
  ON CONFLICT (lease_id, billing_month)
    WHERE is_auto_generated = true
  DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION backfill_lease_history(uuid, uuid) TO authenticated;

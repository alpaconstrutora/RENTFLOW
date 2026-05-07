-- ================================================
-- SPRINT 2: Backfill retroativo de contratos (I1)
-- Função RPC chamada pelo runBackfillAction
-- ================================================
CREATE OR REPLACE FUNCTION backfill_lease_history(p_lease_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  -- Insere mensalidades retroativas desde start_date até o mês anterior ao atual
  -- ON CONFLICT DO NOTHING garante idempotência (Invariante #6)
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
    DATE_TRUNC('month', l.start_date),
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

-- Conceder acesso ao role authenticated para o RPC funcionar via PostgREST
GRANT EXECUTE ON FUNCTION backfill_lease_history(uuid) TO authenticated;

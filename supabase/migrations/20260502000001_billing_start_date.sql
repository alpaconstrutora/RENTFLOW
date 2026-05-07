-- Separa data de início do contrato da data de início das parcelas (carência)
-- NULL = sem carência — COALESCE(billing_start_date, start_date) em todas as queries

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS billing_start_date date;

-- Atualiza backfill: começa de billing_start_date, não de start_date
CREATE OR REPLACE FUNCTION backfill_lease_history(p_lease_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
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

-- Atualiza generate_monthly_rents: só gera se billing_start_date já chegou
CREATE OR REPLACE FUNCTION generate_monthly_rents()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO transactions (
    user_id, lease_id, property_id, type, amount,
    billing_month, due_date, status, is_auto_generated
  )
  SELECT l.user_id, l.id, l.property_id, 'income', l.rent_value,
    DATE_TRUNC('month', CURRENT_DATE),
    MAKE_DATE(
      EXTRACT(YEAR  FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(l.due_day, EXTRACT(DAY FROM
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::int)
    ), 'pending', true
  FROM leases l
  WHERE l.active = true
    AND COALESCE(l.billing_start_date, l.start_date) <= DATE_TRUNC('month', CURRENT_DATE)
  ON CONFLICT (lease_id, billing_month)
    WHERE is_auto_generated = true
  DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- RPC para alterar billing_start_date e cancelar parcelas pendentes anteriores
CREATE OR REPLACE FUNCTION update_billing_start_date(
  p_lease_id           uuid,
  p_billing_start_date date
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_cancelled int;
BEGIN
  UPDATE leases
    SET billing_start_date = p_billing_start_date
  WHERE id = p_lease_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.';
  END IF;

  WITH cancelled AS (
    UPDATE transactions
      SET status = 'cancelled'
    WHERE lease_id          = p_lease_id
      AND is_auto_generated = true
      AND status            = 'pending'
      AND billing_month     < DATE_TRUNC('month', p_billing_start_date)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cancelled FROM cancelled;

  RETURN v_cancelled;
END; $$;

GRANT EXECUTE ON FUNCTION update_billing_start_date(uuid, date) TO authenticated;

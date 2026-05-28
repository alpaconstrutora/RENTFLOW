-- 1. Criação da tabela lease_discounts
CREATE TABLE lease_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES leases ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  start_installment int NOT NULL CHECK (start_installment > 0),
  end_installment int NOT NULL CHECK (end_installment >= start_installment),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  created_at timestamptz DEFAULT now()
);

-- 2. Habilitação de RLS e Políticas
ALTER TABLE lease_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_lease_discounts" ON lease_discounts
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Atualização do motor de faturamento automático (generate_monthly_rents)
CREATE OR REPLACE FUNCTION generate_monthly_rents()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO transactions (
    user_id, lease_id, property_id, type, amount,
    billing_month, due_date, status, is_auto_generated,
    discount_amount
  )
  SELECT l.user_id, l.id, l.property_id, 'income', l.rent_value,
    DATE_TRUNC('month', CURRENT_DATE),
    MAKE_DATE(
      EXTRACT(YEAR  FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(l.due_day, EXTRACT(DAY FROM
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::int)
    ), 'pending', true,
    COALESCE(
      (
        SELECT d.discount_value 
        FROM lease_discounts d
        WHERE d.lease_id = l.id
          AND (
            (EXTRACT(year FROM age(DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', COALESCE(l.billing_start_date, l.start_date)))) * 12 
            + EXTRACT(month FROM age(DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', COALESCE(l.billing_start_date, l.start_date)))) + 1)
            BETWEEN d.start_installment AND d.end_installment
          )
        LIMIT 1
      ), 
      0
    )
  FROM leases l
  WHERE l.active = true
    AND COALESCE(l.billing_start_date, l.start_date) <= DATE_TRUNC('month', CURRENT_DATE)
  ON CONFLICT (lease_id, billing_month)
    WHERE is_auto_generated = true
  DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- 4. Atualização da RPC de geração de retroativos (backfill_lease_history)
CREATE OR REPLACE FUNCTION backfill_lease_history(p_lease_id uuid, p_user_id uuid)
RETURNS int LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  -- Valida ownership usando p_user_id explícito
  IF NOT EXISTS (
    SELECT 1 FROM leases WHERE id = p_lease_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado ou acesso negado.';
  END IF;

  INSERT INTO transactions (
    user_id, lease_id, property_id, type, amount,
    billing_month, due_date, status, is_auto_generated,
    discount_amount
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
    'pending', true,
    COALESCE(
      (
        SELECT d.discount_value 
        FROM lease_discounts d
        WHERE d.lease_id = l.id
          AND (
            (EXTRACT(year FROM age(DATE_TRUNC('month', ref_month), DATE_TRUNC('month', COALESCE(l.billing_start_date, l.start_date)))) * 12 
            + EXTRACT(month FROM age(DATE_TRUNC('month', ref_month), DATE_TRUNC('month', COALESCE(l.billing_start_date, l.start_date)))) + 1)
            BETWEEN d.start_installment AND d.end_installment
          )
        LIMIT 1
      ), 
      0
    )
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

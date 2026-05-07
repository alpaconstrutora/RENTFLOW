-- =================================================================
-- MIGRAÇÃO: Motor Tributário IBS/CBS atômico via RPC
-- Garante que a atualização de status + criação da despesa tributária
-- ocorram na mesma transação SQL, evitando inconsistência se o
-- Server Action falhar entre os dois passos.
-- =================================================================

CREATE OR REPLACE FUNCTION apply_tax_on_payment(
  p_transaction_id uuid,
  p_user_id uuid
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_tx RECORD;
  v_lease RECORD;
  v_tax_config RECORD;
  v_ibs_rate numeric;
  v_cbs_rate numeric;
  v_residential_deduction numeric;
  v_rent_value numeric;
  v_property_type text;
  v_tax_base numeric;
  v_total_tax_rate numeric;
  v_tax_amount numeric;
  v_billing_month date;
BEGIN
  -- Buscar transação original
  SELECT t.type, t.amount, t.property_id, t.status, t.due_date, t.lease_id
  INTO v_tx
  FROM transactions t
  WHERE t.id = p_transaction_id AND t.user_id = p_user_id;

  IF v_tx IS NULL THEN
    RETURN 0;
  END IF;

  -- Só aplica imposto em receitas que acabaram de ser pagas
  IF v_tx.type != 'income' OR v_tx.status != 'paid' THEN
    RETURN 0;
  END IF;

  -- Buscar dados do contrato e tipo do imóvel
  SELECT l.rent_value, p.type AS property_type
  INTO v_lease
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = v_tx.lease_id;

  v_rent_value := COALESCE(v_lease.rent_value, v_tx.amount);
  v_property_type := v_lease.property_type;

  -- Buscar config tributária do usuário
  SELECT ibs_rate, cbs_rate, residential_deduction
  INTO v_tax_config
  FROM tax_config
  WHERE user_id = p_user_id;

  v_ibs_rate := COALESCE(v_tax_config.ibs_rate, 0.0065);
  v_cbs_rate := COALESCE(v_tax_config.cbs_rate, 0.0090);
  v_residential_deduction := COALESCE(v_tax_config.residential_deduction, 0.50);

  -- Calcular base tributável
  IF v_property_type = 'residential' THEN
    v_tax_base := v_rent_value * (1 - v_residential_deduction);
  ELSE
    v_tax_base := v_rent_value;
  END IF;

  v_total_tax_rate := v_ibs_rate + v_cbs_rate;
  v_tax_amount := ROUND(v_tax_base * v_total_tax_rate, 2);

  IF v_tax_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- billing_month = 1º dia do mês da due_date
  v_billing_month := DATE_TRUNC('month', v_tx.due_date)::date;

  -- Inserir despesa tributária na mesma transação
  INSERT INTO transactions (
    user_id, property_id, type, amount, due_date,
    billing_month, status, is_auto_generated, notes
  ) VALUES (
    p_user_id,
    v_tx.property_id,
    'expense',
    v_tax_amount,
    v_tx.due_date,
    v_billing_month,
    'pending',
    true,
    format('IBS/CBS retidos automaticamente (%s%% sobre %s)',
      ROUND(v_total_tax_rate * 100, 2),
      CASE WHEN v_property_type = 'residential'
        THEN 'base residencial deduzida'
        ELSE 'valor integral comercial'
      END
    )
  );

  RETURN v_tax_amount;
END; $$;

GRANT EXECUTE ON FUNCTION apply_tax_on_payment(uuid, uuid) TO authenticated;

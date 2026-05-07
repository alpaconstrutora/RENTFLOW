-- 1. Adicionar colunas
ALTER TABLE transactions 
  ADD COLUMN discount_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN addition_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN adjustment_notes text;

-- 2. Atualizar view transactions_view
DROP VIEW IF EXISTS transactions_view;
CREATE VIEW transactions_view AS
  SELECT 
    t.id, t.user_id, t.lease_id, t.property_id, t.category_id, t.type,
    t.amount, t.due_date, t.billing_month, t.paid_date, t.status,
    t.is_auto_generated, t.notes, t.attachment_url, t.recurrence,
    t.recurrence_group_id, t.parent_transaction_id, t.created_at,
    t.updated_at, t.updated_by,
    t.discount_amount, t.addition_amount, t.adjustment_notes,
    (t.amount + COALESCE(t.addition_amount, 0) - COALESCE(t.discount_amount, 0)) AS net_amount,
    t.xmin::text AS xmin,
    p.name AS property_name
  FROM transactions t
  LEFT JOIN properties p ON t.property_id = p.id
  WHERE t.status != 'cancelled';

GRANT SELECT ON transactions_view TO authenticated;

-- 3. RPC para aplicar ajuste
CREATE OR REPLACE FUNCTION apply_transaction_adjustment(
  p_id uuid,
  p_expected_xmin text,
  p_discount numeric,
  p_addition numeric,
  p_notes text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_affected int; v_tx RECORD;
BEGIN
  SELECT status, is_auto_generated INTO v_tx
  FROM transactions WHERE id = p_id AND user_id = auth.uid();

  IF v_tx IS NULL THEN RAISE EXCEPTION 'Transação não encontrada.'; END IF;
  IF v_tx.status = 'cancelled' THEN RAISE EXCEPTION 'Canceladas são imutáveis.'; END IF;
  IF v_tx.status = 'paid' THEN
    RAISE EXCEPTION 'Transação já liquidada. Faça o ajuste na fatura vinculada.';
  END IF;

  UPDATE transactions
  SET discount_amount = COALESCE(p_discount, 0),
      addition_amount = COALESCE(p_addition, 0),
      adjustment_notes = p_notes
  WHERE id = p_id
    AND xmin::text = p_expected_xmin
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE EXCEPTION 'ConcurrencyError: Registro alterado em outra sessão.';
  END IF;

  -- Domain Event
  INSERT INTO domain_events (user_id, event_type, event_version, source, payload)
  VALUES (
    auth.uid(), 'transaction_adjusted', 1, 'user',
    jsonb_build_object(
      'entity_id', p_id,
      'entity_type', 'transaction',
      'timestamp', NOW()::text,
      'context', jsonb_build_object(
        'discount', p_discount,
        'addition', p_addition,
        'notes', p_notes
      )
    )
  );

  RETURN true;
END; $$;

-- 4. Corrigir o motor tributário
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
  v_net_value numeric;
  v_property_type text;
  v_tax_base numeric;
  v_total_tax_rate numeric;
  v_tax_amount numeric;
  v_billing_month date;
BEGIN
  -- Buscar transação original com cálculos de net_amount
  SELECT t.type, t.amount, t.discount_amount, t.addition_amount, t.property_id, t.status, t.due_date, t.lease_id,
         (t.amount + COALESCE(t.addition_amount, 0) - COALESCE(t.discount_amount, 0)) AS net_amount
  INTO v_tx
  FROM transactions t
  WHERE t.id = p_transaction_id AND t.user_id = p_user_id;

  IF v_tx IS NULL THEN RETURN 0; END IF;
  IF v_tx.type != 'income' OR v_tx.status != 'paid' THEN RETURN 0; END IF;

  -- Buscar tipo do imóvel
  SELECT p.type AS property_type
  INTO v_lease
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = v_tx.lease_id;

  v_net_value := COALESCE(v_tx.net_amount, v_tx.amount);
  v_property_type := COALESCE(v_lease.property_type, 'commercial');

  -- Config tributária
  SELECT ibs_rate, cbs_rate, residential_deduction INTO v_tax_config
  FROM tax_config WHERE user_id = p_user_id;

  v_ibs_rate := COALESCE(v_tax_config.ibs_rate, 0.0065);
  v_cbs_rate := COALESCE(v_tax_config.cbs_rate, 0.0090);
  v_residential_deduction := COALESCE(v_tax_config.residential_deduction, 0.50);

  -- Calcular base tributável sobre o valor LÍQUIDO recebido (v_net_value)
  IF v_property_type = 'residential' THEN
    v_tax_base := v_net_value * (1 - v_residential_deduction);
  ELSE
    v_tax_base := v_net_value;
  END IF;

  v_total_tax_rate := v_ibs_rate + v_cbs_rate;
  v_tax_amount := ROUND(v_tax_base * v_total_tax_rate, 2);

  IF v_tax_amount <= 0 THEN RETURN 0; END IF;

  v_billing_month := DATE_TRUNC('month', v_tx.due_date)::date;

  INSERT INTO transactions (
    user_id, property_id, type, amount, due_date,
    billing_month, status, is_auto_generated, notes
  ) VALUES (
    p_user_id, v_tx.property_id, 'expense', v_tax_amount, v_tx.due_date,
    v_billing_month, 'pending', true,
    format('IBS/CBS retidos automaticamente (%s%% sobre %s - Valor Líquido Recebido)',
      ROUND(v_total_tax_rate * 100, 2),
      CASE WHEN v_property_type = 'residential' THEN 'base residencial deduzida' ELSE 'base integral' END
    )
  );

  RETURN v_tax_amount;
END; $$;

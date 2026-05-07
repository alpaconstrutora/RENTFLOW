CREATE OR REPLACE FUNCTION update_transaction_optimistic(
  p_id uuid,
  p_expected_xmin text,
  p_new_status text,
  p_paid_date date DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_affected int; v_tx RECORD;
BEGIN
  SELECT status, is_auto_generated INTO v_tx
  FROM transactions WHERE id = p_id AND user_id = auth.uid();

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Transação não encontrada.';
  END IF;

  -- INVARIANTE: Canceladas são imutáveis
  IF v_tx.status = 'cancelled' THEN
    RAISE EXCEPTION 'BLOQUEADO: Transações canceladas são imutáveis.';
  END IF;

  -- INVARIANTE #8: Auto-gerada paid é imutável
  IF v_tx.is_auto_generated AND v_tx.status = 'paid' THEN
    RAISE EXCEPTION 'INVARIANTE #8: Fatura auto-gerada já liquidada é imutável. Crie uma transação de ajuste.';
  END IF;

  UPDATE transactions
  SET status = p_new_status,
      paid_date = p_paid_date
  WHERE id = p_id
    AND xmin::text = p_expected_xmin
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'ConcurrencyError: O registro foi alterado em outra sessão. Recarregue para ver a versão atual.';
  END IF;

  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION edit_transaction_fields(
  p_id uuid,
  p_expected_xmin text,
  p_notes text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_affected int; v_tx RECORD;
BEGIN
  SELECT status, is_auto_generated INTO v_tx
  FROM transactions WHERE id = p_id AND user_id = auth.uid();

  IF v_tx IS NULL THEN RAISE EXCEPTION 'Transação não encontrada.'; END IF;
  IF v_tx.status = 'cancelled' THEN RAISE EXCEPTION 'Canceladas são imutáveis.'; END IF;
  IF v_tx.is_auto_generated AND v_tx.status = 'paid' THEN
    RAISE EXCEPTION 'INVARIANTE #8: Auto-gerada paid é imutável.';
  END IF;

  UPDATE transactions
  SET notes = COALESCE(p_notes, notes),
      category_id = COALESCE(p_category_id, category_id)
  WHERE id = p_id
    AND xmin::text = p_expected_xmin
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE EXCEPTION 'ConcurrencyError: Registro alterado em outra sessão.';
  END IF;

  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION edit_recurring_series(
  p_group_id uuid,
  p_notes text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count int;
BEGIN
  WITH updated AS (
    UPDATE transactions
    SET notes = COALESCE(p_notes, notes),
        category_id = COALESCE(p_category_id, category_id),
        amount = COALESCE(p_amount, amount)
    WHERE recurrence_group_id = p_group_id
      AND user_id = auth.uid()
      AND status NOT IN ('cancelled', 'paid')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END; $$;

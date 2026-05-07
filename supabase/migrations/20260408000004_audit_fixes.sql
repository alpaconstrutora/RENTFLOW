-- =================================================================
-- MIGRAÇÃO: Correção de todos os itens PARCIAL e PENDENTE da auditoria
-- Data: 2026-04-08
-- Referência: Auditoria Final RentFlow v6.0
-- =================================================================

-- ═══════════════════════════════════
-- 1. transactions_view com xmin (Optimistic Lock v6)
-- ═══════════════════════════════════
-- Dropar e recriar a view para adicionar xmin (PostgreSQL não permite reordenar colunas com CREATE OR REPLACE)
DROP VIEW IF EXISTS transactions_view;
CREATE VIEW transactions_view AS
  SELECT 
    t.id,
    t.user_id,
    t.lease_id,
    t.property_id,
    t.category_id,
    t.type,
    t.amount,
    t.due_date,
    t.billing_month,
    t.paid_date,
    t.status,
    t.is_auto_generated,
    t.notes,
    t.attachment_url,
    t.recurrence,
    t.recurrence_group_id,
    t.parent_transaction_id,
    t.created_at,
    t.updated_at,
    t.updated_by,
    t.xmin::text AS xmin,             -- [v6] Optimistic lock
    p.name AS property_name
  FROM transactions t
  LEFT JOIN properties p ON t.property_id = p.id
  WHERE t.status != 'cancelled';

GRANT SELECT ON transactions_view TO authenticated;

-- ═══════════════════════════════════
-- 2. RPC: Optimistic lock com xmin (substitui updated_at match)
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION update_transaction_optimistic(
  p_id uuid,
  p_expected_xmin text,
  p_new_status text,
  p_paid_date date DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
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

GRANT EXECUTE ON FUNCTION update_transaction_optimistic(uuid, text, text, date) TO authenticated;

-- ═══════════════════════════════════
-- 3. RPC: Editar campos de transação (notas, categoria) com xmin
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION edit_transaction_fields(
  p_id uuid,
  p_expected_xmin text,
  p_notes text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
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

GRANT EXECUTE ON FUNCTION edit_transaction_fields(uuid, text, text, uuid) TO authenticated;

-- ═══════════════════════════════════
-- 4. RPC: Editar série recorrente ("todas")
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION edit_recurring_series(
  p_group_id uuid,
  p_notes text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY INVOKER AS $$
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

GRANT EXECUTE ON FUNCTION edit_recurring_series(uuid, text, uuid, numeric) TO authenticated;

-- ═══════════════════════════════════
-- 5. Trigger: contract_closed domain_event (PENDENTE D2)
-- ═══════════════════════════════════
CREATE OR REPLACE FUNCTION emit_contract_closed_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO domain_events (user_id, event_type, event_version, source, payload)
  VALUES (
    NEW.user_id,
    'contract_closed',
    1,
    CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'job' END,
    jsonb_build_object(
      'entity_id', NEW.id::text,
      'entity_type', 'lease',
      'timestamp', NOW()::text,
      'context', jsonb_build_object(
        'end_date', NEW.end_date,
        'property_id', NEW.property_id,
        'tenant_id', NEW.tenant_id,
        'lease_id', NEW.id
      )
    )
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_emit_contract_closed
AFTER UPDATE OF active ON leases
FOR EACH ROW
WHEN (OLD.active = true AND NEW.active = false)
EXECUTE FUNCTION emit_contract_closed_event();

-- ================================================
-- P0.2: Auditoria RLS — isolamento multiusuário
-- Gaps encontrados e corrigidos:
--   1. domain_events: RLS ativo mas sem policy SELECT → adicionar
--   2. get_lease_alerts(p_user_id): SECURITY DEFINER + UUID arbitrário → usar auth.uid()
--   3. delete_lease_safe(p_lease_id, p_user_id): idem
--   4. cancel_transaction_safe(p_id, p_user_id): idem
--   5. revert_transaction_paid(p_id, p_user_id): idem
-- Estratégia: manter assinatura (backward compatible), ignorar p_user_id internamente
-- ================================================

-- ── 1. domain_events: SELECT dos próprios eventos
DROP POLICY IF EXISTS "domain_events_select_own" ON domain_events;
CREATE POLICY "domain_events_select_own" ON domain_events
  FOR SELECT USING (user_id = auth.uid());

-- ── 2. get_lease_alerts: p_user_id ignorado → auth.uid()
CREATE OR REPLACE FUNCTION get_lease_alerts(p_user_id uuid)
RETURNS TABLE (
  lease_id         uuid,
  property_name    text,
  tenant_name      text,
  alert_type       text,
  alert_date       date,
  days_remaining   int,
  adjustment_index text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- p_user_id ignorado intencionalmente: usa auth.uid() para isolar por usuário
  SELECT * FROM (
    SELECT
      l.id,
      p.name,
      t.name,
      'contract_expiring'::text,
      l.end_date,
      (l.end_date - CURRENT_DATE)::int,
      l.adjustment_index
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    JOIN tenants t ON l.tenant_id = t.id
    WHERE l.user_id = auth.uid()
      AND l.active = true
      AND l.end_date IS NOT NULL
      AND l.end_date <= CURRENT_DATE + INTERVAL '60 days'

    UNION ALL

    SELECT
      l.id,
      p.name,
      t.name,
      'adjustment_due'::text,
      l.next_adjustment_date,
      (l.next_adjustment_date - CURRENT_DATE)::int,
      l.adjustment_index
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    JOIN tenants t ON l.tenant_id = t.id
    WHERE l.user_id = auth.uid()
      AND l.active = true
      AND l.next_adjustment_date IS NOT NULL
      AND l.next_adjustment_date <= CURRENT_DATE + INTERVAL '30 days'
  ) sub
  ORDER BY 6 ASC;
$$;

-- ── 3. delete_lease_safe: p_user_id ignorado → auth.uid()
CREATE OR REPLACE FUNCTION delete_lease_safe(p_lease_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- p_user_id ignorado intencionalmente: usa auth.uid() para isolar por usuário
  IF NOT EXISTS (
    SELECT 1 FROM leases WHERE id = p_lease_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Contrato não encontrado ou acesso negado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE lease_id = p_lease_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'INTERLOCK FINANCEIRO: Este contrato possui faturas liquidadas.';
  END IF;

  DELETE FROM transactions WHERE lease_id = p_lease_id;
  DELETE FROM leases WHERE id = p_lease_id AND user_id = auth.uid();
END; $$;

-- ── 4. cancel_transaction_safe: p_user_id ignorado → auth.uid()
CREATE OR REPLACE FUNCTION cancel_transaction_safe(p_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tx RECORD;
BEGIN
  -- p_user_id ignorado intencionalmente: usa auth.uid() para isolar por usuário
  SELECT status, is_auto_generated INTO v_tx
  FROM transactions WHERE id = p_id AND user_id = auth.uid();

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Transação não encontrada ou acesso negado.';
  END IF;

  IF v_tx.status = 'paid' AND v_tx.is_auto_generated THEN
    RAISE EXCEPTION 'INVARIANTE #8: Fatura auto-gerada já liquidada é imutável. Crie uma transação de ajuste.';
  END IF;

  UPDATE transactions SET status = 'cancelled' WHERE id = p_id AND user_id = auth.uid();
END; $$;

-- ── 5. revert_transaction_paid: p_user_id ignorado → auth.uid()
CREATE OR REPLACE FUNCTION revert_transaction_paid(p_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- p_user_id ignorado intencionalmente: usa auth.uid() para isolar por usuário
  UPDATE transactions
    SET status = 'pending', paid_date = NULL
  WHERE id = p_id
    AND user_id = auth.uid()
    AND status = 'paid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada ou não está liquidada.';
  END IF;
END; $$;

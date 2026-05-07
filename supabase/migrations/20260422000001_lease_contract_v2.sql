-- ═══════════════════════════════════════════════════════════════
-- Contratos v2: Vigência, Reajuste Automático e Alertas
-- ═══════════════════════════════════════════════════════════════

-- 1. Novas colunas na tabela leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS adjustment_period_months int DEFAULT 12,
  ADD COLUMN IF NOT EXISTS adjustment_index text DEFAULT 'IGPM',
  ADD COLUMN IF NOT EXISTS adjustment_base_date date,
  ADD COLUMN IF NOT EXISTS next_adjustment_date date;

-- 2. RPC para calcular o próximo reajuste
CREATE OR REPLACE FUNCTION recalc_next_adjustment(p_lease_id uuid)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lease RECORD;
  v_next date;
BEGIN
  SELECT adjustment_base_date, adjustment_period_months, start_date, end_date, active, user_id
  INTO v_lease FROM leases WHERE id = p_lease_id AND user_id = auth.uid();

  IF v_lease IS NULL THEN RETURN NULL; END IF;
  IF NOT v_lease.active THEN RETURN NULL; END IF;

  -- Data base: adjustment_base_date ou start_date
  v_next := COALESCE(v_lease.adjustment_base_date, v_lease.start_date)
             + (COALESCE(v_lease.adjustment_period_months, 12) || ' months')::interval;

  -- Avançar até encontrar uma data futura a partir de hoje
  WHILE v_next <= CURRENT_DATE LOOP
    v_next := v_next + (COALESCE(v_lease.adjustment_period_months, 12) || ' months')::interval;
  END LOOP;

  -- Não pode ultrapassar o end_date se existir
  IF v_lease.end_date IS NOT NULL AND v_next > v_lease.end_date THEN
    UPDATE leases SET next_adjustment_date = NULL WHERE id = p_lease_id;
    RETURN NULL;
  END IF;

  UPDATE leases SET next_adjustment_date = v_next WHERE id = p_lease_id;
  RETURN v_next;
END; $$;

-- 3. RPC de alertas para o dashboard
-- NOTA: ORDER BY num UNION ALL precisa de subquery em PostgreSQL
CREATE OR REPLACE FUNCTION get_lease_alerts(p_user_id uuid)
RETURNS TABLE (
  lease_id uuid,
  property_name text,
  tenant_name text,
  alert_type text,
  alert_date date,
  days_remaining int,
  adjustment_index text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM (
    -- Contratos vencendo nos próximos 60 dias
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
    WHERE l.user_id = p_user_id
      AND l.active = true
      AND l.end_date IS NOT NULL
      AND l.end_date <= CURRENT_DATE + INTERVAL '60 days'

    UNION ALL

    -- Reajustes pendentes nos próximos 30 dias
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
    WHERE l.user_id = p_user_id
      AND l.active = true
      AND l.next_adjustment_date IS NOT NULL
      AND l.next_adjustment_date <= CURRENT_DATE + INTERVAL '30 days'
  ) sub
  ORDER BY 6 ASC;
$$;

GRANT EXECUTE ON FUNCTION recalc_next_adjustment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lease_alerts(uuid) TO authenticated;

-- ================================================
-- P0.1: Edge function URL via variável de ambiente
-- Problema: URL hardcoded localhost → falha silenciosa em produção
-- Solução:
--   1. Ampliar status de job_runs para incluir 'warning'
--   2. Usar current_setting('app.edge_url', true) no cron
--   3. Detecção de falha silenciosa (URL ausente + contratos ativos → warning)
--   4. RPC get_last_billing_status para o dashboard
--   5. RPC verify_monthly_billing para diagnóstico manual
-- ================================================

-- 1. Ampliar a constraint de status para incluir 'warning'
ALTER TABLE job_runs DROP CONSTRAINT IF EXISTS job_runs_status_check;
ALTER TABLE job_runs ADD CONSTRAINT job_runs_status_check
  CHECK (status IN ('running','success','failed','aborted','warning'));

-- 2. Permitir que usuários autenticados leiam job_runs (tabela de sistema, sem user_id)
DROP POLICY IF EXISTS "job_runs_read" ON job_runs;
CREATE POLICY "job_runs_read" ON job_runs FOR SELECT USING (true);

-- 3. Unschedule o job antigo para recriar com nova lógica
SELECT cron.unschedule('generate-monthly-rents');

-- 4. Recriar generate-monthly-rents com URL configurável + detecção de falha
SELECT cron.schedule('generate-monthly-rents', '0 10 1 * *', $$
  DO $do$
  DECLARE
    v_run_id    uuid;
    v_edge_url  text;
    v_acquired  boolean;
    v_active_ct int;
    v_status    text;
    v_message   text;
  BEGIN
    -- Advisory lock para evitar execução dupla
    SELECT pg_try_advisory_lock(hashtext('generate-monthly-rents')) INTO v_acquired;
    IF NOT v_acquired THEN
      INSERT INTO job_runs (job_name, status, error_message)
      VALUES ('generate-monthly-rents', 'aborted', 'Advisory lock ativo');
      RETURN;
    END IF;

    INSERT INTO job_runs (job_name, status)
    VALUES ('generate-monthly-rents', 'running')
    RETURNING id INTO v_run_id;

    -- Ler URL da configuração de banco (falha graciosamente se não configurada)
    v_edge_url := current_setting('app.edge_url', true);

    IF v_edge_url IS NULL OR v_edge_url = '' THEN
      -- Verificação: quantos contratos ativos já devem faturar este mês?
      SELECT COUNT(*) INTO v_active_ct
      FROM leases
      WHERE active = true
        AND COALESCE(billing_start_date, start_date) <= DATE_TRUNC('month', CURRENT_DATE);

      IF v_active_ct > 0 THEN
        v_status  := 'warning';
        v_message := 'app.edge_url não configurado — ' || v_active_ct
          || ' contratos ativos sem faturamento. '
          || 'Configure: ALTER DATABASE postgres SET "app.edge_url" = ''https://<project>.supabase.co/functions/v1'';';
      ELSE
        v_status  := 'success';
        v_message := 'app.edge_url não configurado mas não há contratos para faturar este mês.';
      END IF;

      PERFORM pg_advisory_unlock(hashtext('generate-monthly-rents'));

      UPDATE job_runs
        SET status        = v_status,
            error_message = v_message,
            rows_affected = 0,
            duration_ms   = EXTRACT(EPOCH FROM (NOW() - run_at))::int * 1000
      WHERE id = v_run_id;

      RETURN;
    END IF;

    -- Chamar edge function com URL configurável
    PERFORM net.http_post(
      url     := v_edge_url || '/generate-rents',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    );

    -- Contar contratos ativos neste mês (indicativo de sucesso esperado)
    SELECT COUNT(*) INTO v_active_ct
    FROM leases
    WHERE active = true
      AND COALESCE(billing_start_date, start_date) <= DATE_TRUNC('month', CURRENT_DATE);

    PERFORM pg_advisory_unlock(hashtext('generate-monthly-rents'));

    UPDATE job_runs
      SET status        = 'success',
          rows_affected = v_active_ct,
          duration_ms   = EXTRACT(EPOCH FROM (NOW() - run_at))::int * 1000
    WHERE id = v_run_id;

  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(hashtext('generate-monthly-rents'));
    UPDATE job_runs
      SET status        = 'failed',
          error_message = SQLERRM
    WHERE id = v_run_id;

    INSERT INTO domain_events (event_type, event_version, source, payload)
    VALUES ('job_failed', 1, 'job', jsonb_build_object(
      'entity_id',   v_run_id::text,
      'entity_type', 'job',
      'timestamp',   NOW()::text,
      'context',     jsonb_build_object(
        'job_name', 'generate-monthly-rents',
        'error',    SQLERRM
      )
    ));
    RAISE;
  END; $do$
$$);

-- ================================================
-- 5. RPC: get_last_billing_status — dashboard alert
-- Retorna o status do último job generate-monthly-rents
-- ================================================
CREATE OR REPLACE FUNCTION get_last_billing_status()
RETURNS TABLE (
  status        text,
  error_message text,
  rows_affected int,
  run_at        timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT status, error_message, rows_affected, run_at
  FROM job_runs
  WHERE job_name = 'generate-monthly-rents'
  ORDER BY run_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_last_billing_status() TO authenticated;

-- ================================================
-- 6. RPC: verify_monthly_billing — diagnóstico manual
-- Retorna contratos sem parcela no mês solicitado
-- ================================================
CREATE OR REPLACE FUNCTION verify_monthly_billing(
  p_month date DEFAULT DATE_TRUNC('month', CURRENT_DATE)::date
)
RETURNS TABLE (
  lease_id         uuid,
  property_name    text,
  tenant_name      text,
  rent_value       numeric,
  billing_start    date,
  has_transaction  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    l.id,
    p.name,
    COALESCE(t.name, 'Sem inquilino') AS tenant_name,
    l.rent_value,
    COALESCE(l.billing_start_date, l.start_date)::date AS billing_start,
    EXISTS (
      SELECT 1 FROM transactions tx
      WHERE tx.lease_id = l.id
        AND DATE_TRUNC('month', tx.billing_month) = DATE_TRUNC('month', p_month)
    ) AS has_transaction
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  LEFT JOIN tenants t ON t.id = l.tenant_id
  WHERE l.active = true
    AND l.user_id = auth.uid()
    AND COALESCE(l.billing_start_date, l.start_date) <= p_month
  ORDER BY has_transaction, p.name;
$$;

GRANT EXECUTE ON FUNCTION verify_monthly_billing(date) TO authenticated;

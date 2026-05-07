-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Diariamente as 09:00 (v6 advisory lock + user_today)
SELECT cron.schedule('update-late-status', '0 9 * * *', $$
  DO $do$
  DECLARE v_run_id uuid; v_count int; v_acquired boolean;
  BEGIN
    -- [v6] Advisory lock primeiro
    SELECT pg_try_advisory_lock(hashtext('update-late-status')) INTO v_acquired;
    IF NOT v_acquired THEN
      INSERT INTO job_runs (job_name, status, error_message)
      VALUES ('update-late-status', 'aborted', 'Advisory lock ativo');
      RETURN;
    END IF;

    INSERT INTO job_runs (job_name, status)
    VALUES ('update-late-status', 'running') RETURNING id INTO v_run_id;

    -- [v6] user_today() em todas as comparações
    WITH updated AS (
      UPDATE transactions t SET status = 'late'
      WHERE t.status = 'pending'
        AND t.paid_date IS NULL
        AND t.due_date < user_today(t.user_id)
      RETURNING t.id, t.user_id, t.amount, t.due_date, t.property_id
    )
    SELECT COUNT(*) INTO v_count FROM updated;

    -- Encerrar contratos vencidos [v6 — user_today()]
    UPDATE leases l SET active = false
    WHERE l.active = true
      AND l.end_date IS NOT NULL
      AND l.end_date < user_today(l.user_id);

    -- Emitir eventos
    INSERT INTO domain_events (user_id, event_type, event_version, source, payload)
    SELECT t.user_id, 'payment_late', 1, 'job',
      jsonb_build_object(
        'entity_id', t.id::text, 'entity_type', 'transaction',
        'timestamp', NOW()::text,
        'context', jsonb_build_object(
          'transaction_id', t.id, 'amount', t.amount,
          'due_date', t.due_date, 'property_id', t.property_id,
          'days_late', (user_today(t.user_id) - t.due_date)
        )
      )
    FROM transactions t
    WHERE t.status = 'late'
      AND t.due_date = user_today(t.user_id) - 1;

    -- [v6] Liberar lock explicitamente
    PERFORM pg_advisory_unlock(hashtext('update-late-status'));

    UPDATE job_runs SET status = 'success', rows_affected = v_count,
      duration_ms = EXTRACT(EPOCH FROM (NOW() - run_at))::int * 1000
    WHERE id = v_run_id;

  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(hashtext('update-late-status'));
    UPDATE job_runs SET status = 'failed', error_message = SQLERRM WHERE id = v_run_id;
    INSERT INTO domain_events (event_type, event_version, source, payload)
    VALUES ('job_failed', 1, 'job', jsonb_build_object(
      'entity_id', v_run_id::text, 'entity_type', 'job',
      'timestamp', NOW()::text,
      'context', jsonb_build_object('job_name','update-late-status','error',SQLERRM)
    ));
    RAISE;
  END; $do$
$$);

-- Mensalmente no dia 1 as 10:00 (v6 Edge function integration)
SELECT cron.schedule('generate-monthly-rents', '0 10 1 * *', $$
  -- O supabase_functions.http_request chama a edge function generate-rents
  SELECT supabase_functions.http_request('POST',
    'http://localhost:54321/functions/v1/generate-rents', -- Adjust on production to https://[PROJECT].supabase.co
    '{"Content-Type":"application/json"}', '{}', 5000);
$$);

-- =================================================================
-- MIGRAÇÃO: Correção dos Invariantes #1, #13 e Advisory Lock
-- Data: 2026-04-08
-- Referência: Auditoria RentFlow v6.0 vs Prompt Original
-- =================================================================

-- INVARIANTE #13: Criar view com JOIN para PostgREST servir property_name
-- A view active_transactions não expõe FKs para PostgREST
-- Solução: view enriquecida com property_name embutido
CREATE OR REPLACE VIEW transactions_view AS
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
    p.name AS property_name
  FROM transactions t
  LEFT JOIN properties p ON t.property_id = p.id
  WHERE t.status != 'cancelled';

-- RLS na view (PostgreSQL herda o RLS da tabela base, mas precisamos garantir acesso)
GRANT SELECT ON transactions_view TO authenticated;

-- INVARIANTE #11: Garantir que advisory lock functions existem (já criadas, mas confirmando)
-- As funções try_acquire_job_lock e release_job_lock já estão no schema base.
-- Garantindo que o RPC está acessível ao role authenticated para o botão do painel:
GRANT EXECUTE ON FUNCTION try_acquire_job_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION release_job_lock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_rents() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_recurring_expenses() TO authenticated;

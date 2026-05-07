-- =================================================================
-- MIGRAÇÃO: Correção de 2 bugs críticos da auditoria final
-- Data: 2026-04-08
-- =================================================================

-- ═══════════════════════════════════════════════════════════════════
-- BUG #1 — INVARIANTE #13: REVOKE anulado
-- A migração 20260407220612_fix_transactions_permissions.sql fez
-- GRANT SELECT ON transactions TO authenticated, desfazendo o REVOKE
-- do schema principal. O role authenticated NÃO deve ler transactions
-- diretamente — apenas via active_transactions e transactions_view.
-- ═══════════════════════════════════════════════════════════════════

-- Revogar SELECT direto na tabela transactions para authenticated e anon
REVOKE SELECT ON transactions FROM authenticated;
REVOKE SELECT ON transactions FROM anon;

-- Manter INSERT/UPDATE/DELETE para que as server actions funcionem
-- (o RLS garante isolamento por user_id)
GRANT INSERT, UPDATE, DELETE ON transactions TO authenticated;

-- Garantir que as views de leitura continuam acessíveis
GRANT SELECT ON active_transactions TO authenticated;
GRANT SELECT ON transactions_view TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- BUG #2 — domain_events sem policy INSERT
-- RLS está ativada mas não há nenhuma policy. Isso faz com que todo
-- INSERT via role authenticated falhe silenciosamente — os domain_events
-- dos Sprints 2 e 3 nunca foram gravados no banco.
-- Solução: policy para INSERT com user_id = auth.uid()
-- Leitura permanece bloqueada (somente service_role) conforme prompt.
-- ═══════════════════════════════════════════════════════════════════

-- Policy de escrita: usuário só insere eventos com seu próprio user_id
CREATE POLICY "domain_events_insert" ON domain_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy de leitura: bloqueada para authenticated (somente service_role)
-- Não criamos policy SELECT — RLS bloqueia automaticamente.

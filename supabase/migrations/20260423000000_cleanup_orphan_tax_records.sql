-- =================================================================
-- LIMPEZA PONTUAL (TESTE): Lançamentos Tributários Órfãos
-- =================================================================
-- Contexto: Durante os testes, contratos foram excluídos via
-- delete_lease_safe(). Porém, a função apply_tax_on_payment()
-- insere despesas de IBS/CBS SEM lease_id (campo não incluído
-- no INSERT). Por isso, ao excluir o contrato, essas despesas
-- ficaram órfãs na tabela transactions.
--
-- ATENÇÃO: Versão ampliada — apaga TODOS os lançamentos
-- marcados como is_auto_generated=true e type='expense',
-- independente de status (pending, paid, etc.) ou texto das notes.
-- Usado somente para limpeza de ambiente de testes.
-- A arquitetura (funções, triggers, RLS) permanece intacta.
-- =================================================================

DELETE FROM transactions
WHERE
  is_auto_generated = true
  AND type = 'expense';

-- Confirma quantos registros foram removidos (aparece no log do Supabase)
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Limpeza concluída: % lançamento(s) tributário(s) auto-gerado(s) removido(s).', v_count;
END $$;

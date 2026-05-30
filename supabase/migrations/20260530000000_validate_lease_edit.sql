-- Migração: Validação e Restrição de Edição de Contratos Ativos / Emitidos
-- Criado em: 2026-05-30
-- Referência Sequencial: 20260530000000

CREATE OR REPLACE FUNCTION public.validate_lease_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_has_transactions boolean;
  v_is_issued boolean;
BEGIN
  -- 1. Verifica se existem transações financeiras geradas para este contrato
  SELECT EXISTS (
    SELECT 1 FROM public.transactions 
    WHERE lease_id = OLD.id
  ) INTO v_has_transactions;

  -- 2. Verifica se existem instâncias de contrato oficial emitidas (prontas, assinadas ou arquivadas)
  SELECT EXISTS (
    SELECT 1 FROM public.contract_instances 
    WHERE lease_id = OLD.id 
      AND status IN ('ready', 'signed', 'archived')
  ) INTO v_is_issued;

  -- 3. Se houver lançamentos ou se já foi emitido, restringe a alteração de cláusulas estruturais críticas
  IF (v_has_transactions OR v_is_issued) THEN
    IF (
      OLD.property_id != NEW.property_id OR
      OLD.tenant_id != NEW.tenant_id OR
      OLD.start_date != NEW.start_date OR
      OLD.due_day != NEW.due_day OR
      OLD.billing_start_date IS DISTINCT FROM NEW.billing_start_date OR
      OLD.adjustment_period_months IS DISTINCT FROM NEW.adjustment_period_months OR
      OLD.adjustment_index IS DISTINCT FROM NEW.adjustment_index
    ) THEN
      RAISE EXCEPTION 'CONTRATO_ATIVO_BLOQUEADO: Este contrato já possui lançamentos financeiros ou foi emitido oficialmente. Não é permitido alterar cláusulas estruturais (imóvel, inquilino, data de início, dia de vencimento, carência, periodicidade ou índice de reajuste).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Criar trigger na tabela leases
DROP TRIGGER IF EXISTS trg_validate_lease_edit ON public.leases;

CREATE TRIGGER trg_validate_lease_edit
BEFORE UPDATE ON public.leases
FOR EACH ROW
EXECUTE FUNCTION public.validate_lease_edit();

-- Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION public.validate_lease_edit() TO authenticated;

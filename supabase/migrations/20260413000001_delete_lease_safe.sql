CREATE OR REPLACE FUNCTION delete_lease_safe(p_lease_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Verifica se o contrato pertence ao usuário (Segurança)
  IF NOT EXISTS (SELECT 1 FROM leases WHERE id = p_lease_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Contrato não encontrado ou acesso negado.';
  END IF;

  -- 2. INVARIANTE #1: Bloqueia se existir qualquer fatura liquidada ('paid')
  IF EXISTS (
    SELECT 1 FROM transactions 
    WHERE lease_id = p_lease_id 
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'INTERLOCK FINANCEIRO: Este contrato possui faturas liquidadas.';
  END IF;

  -- 3. Apaga as faturas residuais (pending, late, cancelled)
  DELETE FROM transactions WHERE lease_id = p_lease_id;

  -- 4. Apaga o contrato (agora livre das restrições de ON DELETE SET NULL)
  DELETE FROM leases WHERE id = p_lease_id;
END;
$$;

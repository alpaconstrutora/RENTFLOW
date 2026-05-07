CREATE OR REPLACE FUNCTION cancel_transaction_safe(p_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tx RECORD;
BEGIN
  SELECT status, is_auto_generated INTO v_tx
  FROM transactions WHERE id = p_id AND user_id = p_user_id;

  IF v_tx IS NULL THEN 
    RAISE EXCEPTION 'Transação não encontrada ou acesso negado.'; 
  END IF;

  IF v_tx.status = 'paid' AND v_tx.is_auto_generated THEN
    RAISE EXCEPTION 'INVARIANTE #8: Fatura auto-gerada já liquidada é imutável. Crie uma transação de ajuste.';
  END IF;

  UPDATE transactions SET status = 'cancelled' WHERE id = p_id AND user_id = p_user_id;
END; $$;

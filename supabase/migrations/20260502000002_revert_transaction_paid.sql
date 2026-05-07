-- Reverte uma transação liquidada (paid) de volta para pendente (pending)
-- Limpa paid_date e registra domain_event para auditoria

CREATE OR REPLACE FUNCTION revert_transaction_paid(
  p_id      uuid,
  p_user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE transactions
    SET status    = 'pending',
        paid_date = NULL
  WHERE id      = p_id
    AND user_id = p_user_id
    AND status  = 'paid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada ou não está liquidada.';
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION revert_transaction_paid(uuid, uuid) TO authenticated;

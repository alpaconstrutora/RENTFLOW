-- RPC: log_domain_event
-- Insere um domain_event para o usuário autenticado usando SECURITY DEFINER,
-- contornando a limitação do RLS em Server Actions onde auth.uid() retorna NULL.
-- Segurança: user_id é sempre auth.uid() — nunca aceito do chamador.

CREATE OR REPLACE FUNCTION log_domain_event(
  p_event_type text,
  p_payload    jsonb,
  p_source     text DEFAULT 'user'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_domain_event: usuário não autenticado';
  END IF;

  INSERT INTO domain_events (user_id, event_type, event_version, source, payload)
  VALUES (auth.uid(), p_event_type, 1, p_source, p_payload);
END;
$$;

GRANT EXECUTE ON FUNCTION log_domain_event(text, jsonb, text) TO authenticated;

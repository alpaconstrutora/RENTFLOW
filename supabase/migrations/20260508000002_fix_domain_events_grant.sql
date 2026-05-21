-- Correção: domain_events sem GRANT INSERT para authenticated.
-- A migration 20260408000003 criou a RLS policy mas esqueceu o GRANT,
-- fazendo o INSERT falhar com "row-level security policy" ao criar contratos.

GRANT INSERT ON domain_events TO authenticated;

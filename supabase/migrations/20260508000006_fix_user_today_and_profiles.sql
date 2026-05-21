-- Fix 1: user_today com fallback para America/Sao_Paulo quando profile não existe
-- Evita NULL no generate_series do backfill_lease_history

CREATE OR REPLACE FUNCTION user_today(p_user_id uuid)
RETURNS date LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date
     FROM profiles WHERE id = p_user_id),
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
  );
$$;

-- Fix 2: Backfill — cria profiles para usuários que já existem sem perfil
-- Filtra por auth.users para não violar FK constraint
INSERT INTO profiles (id, timezone)
SELECT DISTINCT u.user_id, 'America/Sao_Paulo'
FROM (
  SELECT user_id FROM leases
  UNION
  SELECT user_id FROM transactions
  UNION
  SELECT user_id FROM properties
  UNION
  SELECT user_id FROM tenants
) u
INNER JOIN auth.users au ON au.id = u.user_id
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.user_id)
ON CONFLICT (id) DO NOTHING;

-- Fix 3: Trigger para criar perfil automaticamente no cadastro
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, timezone)
  VALUES (NEW.id, 'America/Sao_Paulo')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

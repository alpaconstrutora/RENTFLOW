-- ================================================
-- SPRINT FIX: user_today com COALESCE fallback
-- Causa: novos usuários sem profile ainda → função retorna NULL → TypeError
-- Solução: fallback para CURRENT_DATE no fuso America/Sao_Paulo
-- ================================================
CREATE OR REPLACE FUNCTION user_today(p_user_id uuid)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date
     FROM profiles WHERE id = p_user_id),
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
  );
$$;

-- Garantir que o profile é criado ao registrar (trigger on auth.users)
-- Evita o problema na raiz: profile sempre existirá após signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, plan, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'Usuário'),
    'trial',
    'America/Sao_Paulo'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Registrar trigger no auth.users (drop antes para recriar sem erro)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO profiles (id, name, plan, timezone)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'name', email, 'Usuário'), 
  'trial', 
  'America/Sao_Paulo'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, name, plan, timezone)
SELECT _await_response  id, _await_response  COALESCE(raw_user_meta_data->>'name', email, 'Usuario'), _await_response  'trial', _await_response  'America/Sao_Paulo'
FROM auth.usersON CONFLICT (id) DO NOTHING;
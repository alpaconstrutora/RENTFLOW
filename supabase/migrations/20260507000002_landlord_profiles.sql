-- landlord_profiles: múltiplos perfis de locador por usuário (PF/PJ)
-- Phase 1: criação da tabela, FK em leases, migração de dados e RPCs

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.landlord_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_type     text NOT NULL DEFAULT 'pf' CHECK (person_type IN ('pf', 'pj')),
  name            text NOT NULL,
  document        text,
  email           text,
  phone           text,
  address         text,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Garante no máximo um perfil default por usuário
CREATE UNIQUE INDEX IF NOT EXISTS landlord_profiles_one_default
  ON public.landlord_profiles (user_id)
  WHERE is_default = true;

ALTER TABLE public.landlord_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'landlord_profiles' AND policyname = 'user_isolation_landlord_profiles'
  ) THEN
    CREATE POLICY "user_isolation_landlord_profiles" ON public.landlord_profiles
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. FK opcional em leases (null = usa perfil default do usuário)
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS landlord_profile_id uuid REFERENCES public.landlord_profiles ON DELETE SET NULL;

-- 3. Migração de dados: criar perfil default para usuários existentes
-- Usa user_metadata (name, document, phone, address) se disponível
INSERT INTO public.landlord_profiles (user_id, person_type, name, document, email, phone, address, is_default)
SELECT
  u.id,
  'pf',
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), u.email, 'Proprietário'),
  NULLIF(TRIM(u.raw_user_meta_data->>'document'), ''),
  u.email,
  NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'address'), ''),
  true
FROM auth.users u
WHERE u.id NOT IN (SELECT DISTINCT user_id FROM public.landlord_profiles);

-- 4. RPC: criar ou editar perfil
CREATE OR REPLACE FUNCTION upsert_landlord_profile(
  p_id           uuid,        -- NULL para criar, UUID para editar
  p_person_type  text,
  p_name         text,
  p_document     text,
  p_email        text,
  p_phone        text,
  p_address      text,
  p_is_default   boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Garante que o perfil a editar pertence ao usuário
  IF p_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.landlord_profiles WHERE id = p_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Perfil não encontrado.';
    END IF;
  END IF;

  -- Se vai virar default, remove o flag dos outros primeiro
  IF p_is_default THEN
    UPDATE public.landlord_profiles
      SET is_default = false
    WHERE user_id = auth.uid() AND is_default = true AND (p_id IS NULL OR id <> p_id);
  END IF;

  IF p_id IS NULL THEN
    -- INSERT
    INSERT INTO public.landlord_profiles (user_id, person_type, name, document, email, phone, address, is_default)
    VALUES (auth.uid(), p_person_type, p_name, NULLIF(TRIM(p_document), ''), NULLIF(TRIM(p_email), ''), NULLIF(TRIM(p_phone), ''), NULLIF(TRIM(p_address), ''), p_is_default)
    RETURNING id INTO v_id;
  ELSE
    -- UPDATE
    UPDATE public.landlord_profiles SET
      person_type = p_person_type,
      name        = p_name,
      document    = NULLIF(TRIM(p_document), ''),
      email       = NULLIF(TRIM(p_email), ''),
      phone       = NULLIF(TRIM(p_phone), ''),
      address     = NULLIF(TRIM(p_address), ''),
      is_default  = p_is_default
    WHERE id = p_id AND user_id = auth.uid()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION upsert_landlord_profile(uuid, text, text, text, text, text, text, boolean) TO authenticated;

-- 5. RPC: definir perfil como default
CREATE OR REPLACE FUNCTION set_default_landlord_profile(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.landlord_profiles WHERE id = p_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;
  UPDATE public.landlord_profiles SET is_default = false WHERE user_id = auth.uid();
  UPDATE public.landlord_profiles SET is_default = true  WHERE id = p_id AND user_id = auth.uid();
END; $$;

GRANT EXECUTE ON FUNCTION set_default_landlord_profile(uuid) TO authenticated;

-- 6. RPC: excluir perfil (não pode excluir o default se houver outros)
CREATE OR REPLACE FUNCTION delete_landlord_profile(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_is_default boolean; v_count int;
BEGIN
  SELECT is_default INTO v_is_default FROM public.landlord_profiles WHERE id = p_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.landlord_profiles WHERE user_id = auth.uid();
  IF v_is_default AND v_count > 1 THEN
    RAISE EXCEPTION 'Defina outro perfil como padrão antes de excluir este.';
  END IF;

  -- Desvincula contratos que usavam este perfil
  UPDATE public.leases SET landlord_profile_id = NULL WHERE landlord_profile_id = p_id AND user_id = auth.uid();

  DELETE FROM public.landlord_profiles WHERE id = p_id AND user_id = auth.uid();
END; $$;

GRANT EXECUTE ON FUNCTION delete_landlord_profile(uuid) TO authenticated;

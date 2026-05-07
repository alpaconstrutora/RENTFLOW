CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name text,
  phone text,
  plan text DEFAULT 'trial',
  trial_ends_at timestamptz,
  timezone text DEFAULT 'America/Sao_Paulo',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'user_isolation_profiles'
  ) THEN
    CREATE POLICY "user_isolation_profiles" ON public.profiles
      USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Módulo de Dados Bancários para Inquilinos e Perfis de Locador
-- Migration: 20260528000000_bank_accounts.sql

-- 1. Criação dos enums se não existirem
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bank_account_type') THEN
    CREATE TYPE bank_account_type AS ENUM ('checking', 'savings', 'payment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_key_type') THEN
    CREATE TYPE pix_key_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');
  END IF;
END $$;

-- 2. Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Relacionamento Polimórfico Seguro
  tenant_id           uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  landlord_profile_id uuid REFERENCES public.landlord_profiles(id) ON DELETE CASCADE,
  
  bank_name           text NOT NULL,
  bank_code           text NOT NULL,
  branch              text NOT NULL,
  branch_digit        text,
  account             text NOT NULL,
  account_digit       text,
  account_type        bank_account_type NOT NULL DEFAULT 'checking',
  
  holder_name         text NOT NULL,
  holder_document     text NOT NULL, -- CPF/CNPJ do Favorecido
  
  pix_key             text,
  pix_key_type        pix_key_type,
  
  is_main_account     boolean NOT NULL DEFAULT false,
  is_main_pix         boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  
  -- Invariante: a conta pertence a exatamente um inquilino OU um locador
  CONSTRAINT bank_accounts_owner_check CHECK (
    (tenant_id IS NOT NULL AND landlord_profile_id IS NULL) OR
    (tenant_id IS NULL AND landlord_profile_id IS NOT NULL)
  )
);

-- 3. Índices de Integridade (Apenas uma conta/PIX principal ativa por dono)
CREATE UNIQUE INDEX IF NOT EXISTS uq_main_account_tenant 
  ON public.bank_accounts (tenant_id) 
  WHERE (is_main_account = true AND is_active = true AND tenant_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_main_account_profile 
  ON public.bank_accounts (landlord_profile_id) 
  WHERE (is_main_account = true AND is_active = true AND landlord_profile_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_main_pix_tenant 
  ON public.bank_accounts (tenant_id) 
  WHERE (is_main_pix = true AND is_active = true AND tenant_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_main_pix_profile 
  ON public.bank_accounts (landlord_profile_id) 
  WHERE (is_main_pix = true AND is_active = true AND landlord_profile_id IS NOT NULL);

-- 4. Habilitação de Row Level Security (RLS)
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'user_isolation_bank_accounts'
  ) THEN
    CREATE POLICY "user_isolation_bank_accounts" ON public.bank_accounts
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 5. Trigger de updated_at para atualizar de forma automática
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER trg_update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

-- 6. Grants de Acesso
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;

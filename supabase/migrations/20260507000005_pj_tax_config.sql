-- Tributos PJ (Lucro Presumido): PIS, COFINS, CSLL, IRPJ
-- Aplicável a locadores com CNPJ no regime de Lucro Presumido.
-- Base de cálculo padrão: 32% da receita bruta (presunção para locação de imóveis).

-- 1. Tabela de configuração de alíquotas por usuário
CREATE TABLE IF NOT EXISTS public.pj_tax_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  pis_rate             numeric(8,6) NOT NULL DEFAULT 0.006500,  -- 0.65%
  cofins_rate          numeric(8,6) NOT NULL DEFAULT 0.030000,  -- 3.00%
  csll_rate            numeric(8,6) NOT NULL DEFAULT 0.028800,  -- 2.88% (9% × 32%)
  irpj_rate            numeric(8,6) NOT NULL DEFAULT 0.048000,  -- 4.80% (15% × 32%)
  presumed_base_factor numeric(5,4) NOT NULL DEFAULT 0.3200,    -- 32% lucro presumido
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.pj_tax_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pj_tax_config' AND policyname = 'user_isolation_pj_tax_config'
  ) THEN
    CREATE POLICY "user_isolation_pj_tax_config" ON public.pj_tax_config
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 2. Seed: criar config padrão para usuários existentes
INSERT INTO public.pj_tax_config (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.pj_tax_config);

-- 3. Categorias de sistema para lançamento desses tributos
INSERT INTO categories (name, type, is_system, tax_category)
SELECT 'PIS', 'expense', true, 'tax_expense'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'PIS' AND is_system = true);

INSERT INTO categories (name, type, is_system, tax_category)
SELECT 'COFINS', 'expense', true, 'tax_expense'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'COFINS' AND is_system = true);

INSERT INTO categories (name, type, is_system, tax_category)
SELECT 'CSLL', 'expense', true, 'tax_expense'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'CSLL' AND is_system = true);

INSERT INTO categories (name, type, is_system, tax_category)
SELECT 'IRPJ (Lucro Presumido)', 'expense', true, 'tax_expense'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'IRPJ (Lucro Presumido)' AND is_system = true);

-- 4. RPC para salvar configuração PJ
CREATE OR REPLACE FUNCTION upsert_pj_tax_config(
  p_pis_rate             numeric,
  p_cofins_rate          numeric,
  p_csll_rate            numeric,
  p_irpj_rate            numeric,
  p_presumed_base_factor numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.pj_tax_config (user_id, pis_rate, cofins_rate, csll_rate, irpj_rate, presumed_base_factor, updated_at)
  VALUES (auth.uid(), p_pis_rate, p_cofins_rate, p_csll_rate, p_irpj_rate, p_presumed_base_factor, now())
  ON CONFLICT (user_id) DO UPDATE SET
    pis_rate             = EXCLUDED.pis_rate,
    cofins_rate          = EXCLUDED.cofins_rate,
    csll_rate            = EXCLUDED.csll_rate,
    irpj_rate            = EXCLUDED.irpj_rate,
    presumed_base_factor = EXCLUDED.presumed_base_factor,
    updated_at           = now();
END; $$;

GRANT EXECUTE ON FUNCTION upsert_pj_tax_config(numeric, numeric, numeric, numeric, numeric) TO authenticated;

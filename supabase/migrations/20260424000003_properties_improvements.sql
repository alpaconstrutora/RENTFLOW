-- ═══════════════════════════════════════════════════════════════
-- Properties v2: tipo granular + endereço estruturado
-- ═══════════════════════════════════════════════════════════════

-- 1. Tipo granular — remover constraint antiga e criar nova
DO $$
DECLARE v_cname text;
BEGIN
  SELECT conname INTO v_cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'properties'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%type%';
  IF v_cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.properties DROP CONSTRAINT ' || quote_ident(v_cname);
  END IF;
END $$;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    'residential','commercial',
    'apartment','house','studio',
    'commercial_room','store','warehouse','land'
  ));

-- 2. Endereço estruturado (mantém coluna address como complemento)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS zip_code      text,
  ADD COLUMN IF NOT EXISTS street        text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS district      text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS state         text;

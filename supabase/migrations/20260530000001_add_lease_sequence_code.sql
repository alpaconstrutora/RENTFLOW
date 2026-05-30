-- Migração para adicionar código sequencial por proprietário para cada contrato (leases)
-- Começando de 1 (formatado na aplicação como 001, 002, etc.)

-- 1. Adicionar a coluna inicialmente opcional
ALTER TABLE leases ADD COLUMN IF NOT EXISTS code int;

-- 2. Realizar o backfill de contratos existentes, gerando códigos sequenciais baseados na ordem de criação por user_id
WITH ranked_leases AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) as row_num
  FROM leases
)
UPDATE leases l
SET code = r.row_num
FROM ranked_leases r
WHERE l.id = r.id AND l.code IS NULL;

-- 3. Tornar a coluna NOT NULL e UNIQUE por usuário
ALTER TABLE leases ALTER COLUMN code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_leases_user_code'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT uq_leases_user_code UNIQUE (user_id, code);
  END IF;
END $$;

-- 4. Função e trigger para novos registros definirem o código automaticamente
CREATE OR REPLACE FUNCTION set_next_lease_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max int;
BEGIN
  IF NEW.code IS NULL THEN
    SELECT COALESCE(MAX(code), 0) INTO v_max
    FROM leases
    WHERE user_id = NEW.user_id;
    NEW.code := v_max + 1;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_set_next_lease_code
BEFORE INSERT ON leases
FOR EACH ROW
EXECUTE FUNCTION set_next_lease_code();

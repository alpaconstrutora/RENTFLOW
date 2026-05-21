-- Conexão do módulo de tributos (Lucro Presumido) ao fluxo de caixa.
--
-- 1. property_id agora é nullable em transactions para despesas tributárias
--    de portfólio (PIS, COFINS, CSLL, IRPJ) que não pertencem a um único imóvel.
--    A constraint de integridade é preservada: income ainda exige property_id.
--
-- 2. Adiciona categorias de sistema para os quatro tributos do Lucro Presumido.

-- ─── 1. Torna property_id nullable ──────────────────────────────────────────

ALTER TABLE transactions ALTER COLUMN property_id DROP NOT NULL;

-- Income continua exigindo property_id (Invariante #2)
ALTER TABLE transactions
  ADD CONSTRAINT chk_income_requires_property
  CHECK (type != 'income' OR property_id IS NOT NULL);

-- ─── 2. Categorias de sistema para tributos PJ ──────────────────────────────

INSERT INTO categories (name, type, is_system, tax_category)
SELECT v.name, v.type::text, true, 'tax_expense'
FROM (VALUES
  ('PIS',                    'expense'),
  ('COFINS',                 'expense'),
  ('CSLL',                   'expense'),
  ('IRPJ (Lucro Presumido)', 'expense')
) AS v(name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.name = v.name AND c.is_system = true
);

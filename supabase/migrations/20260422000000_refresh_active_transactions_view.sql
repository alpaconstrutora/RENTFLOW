-- ═══════════════════════════════════════════════════════════════
-- Atualizar active_transactions para incluir novas colunas
-- (discount_amount, addition_amount, adjustment_notes)
-- 
-- CAUSA: A view foi criada com SELECT * antes da migração
-- 20260413000004 adicionar essas colunas. O PostgreSQL congela
-- o schema da view no momento da criação, então SELECT * não
-- inclui colunas adicionadas posteriormente.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW active_transactions AS
  SELECT * FROM transactions
  WHERE status != 'cancelled';

-- Manter o GRANT existente
GRANT SELECT ON active_transactions TO authenticated;

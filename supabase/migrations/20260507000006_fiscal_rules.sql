-- Tabela de versionamento de regras fiscais
-- Permite rastrear qual conjunto de regras gerou cada cálculo (auditabilidade).
-- Cada linha representa uma regra específica em uma versão de ruleset.

CREATE TABLE IF NOT EXISTS fiscal_rules (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ruleset_version  text        NOT NULL,
  rule_key         text        NOT NULL,
  rule_value       jsonb       NOT NULL,
  effective_from   date        NOT NULL DEFAULT CURRENT_DATE,
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_version, rule_key)
);

ALTER TABLE fiscal_rules ENABLE ROW LEVEL SECURITY;

-- Leitura pública autenticada (regras não são dados sensíveis)
CREATE POLICY "fiscal_rules_read" ON fiscal_rules
  FOR SELECT TO authenticated USING (true);

-- Apenas service role pode inserir/alterar (via migrations)
-- Usuários não editam diretamente regras fiscais

-- Seed: ruleset 2025.1 (Sprint 1 — implementado em 2026-05-07)
INSERT INTO fiscal_rules (ruleset_version, rule_key, rule_value, effective_from, description) VALUES
  ('2025.1', 'irrf_due_day',           '{"day": 20}',                          '2025-01-01', 'IRRF aluguel (cód. 3208) — 2º decêndio do mês subsequente'),
  ('2025.1', 'pis_cofins_due_day',     '{"day": 25}',                          '2025-01-01', 'PIS/COFINS — dia 25 do mês seguinte à competência'),
  ('2025.1', 'csll_irpj_periodicity',  '{"type": "trimestral"}',               '2025-01-01', 'CSLL/IRPJ — apuração trimestral (Lucro Presumido)'),
  ('2025.1', 'csll_irpj_due',          '{"type": "last_business_day_next_month_after_quarter"}', '2025-01-01', 'Último dia útil do mês após encerramento do trimestre'),
  ('2025.1', 'carneleao_due',          '{"type": "last_business_day_next_month"}', '2025-01-01', 'Carnê-Leão — último dia útil do mês seguinte'),
  ('2025.1', 'presumed_base_factor',   '{"rate": 0.32, "legal_ref": "Lei 9.249/95, art. 15"}', '2025-01-01', 'Base de presunção 32% para receita de aluguel'),
  ('2025.1', 'pis_rate_default',       '{"rate": 0.0065}',                     '2025-01-01', 'PIS — alíquota padrão Lucro Presumido'),
  ('2025.1', 'cofins_rate_default',    '{"rate": 0.030}',                      '2025-01-01', 'COFINS — alíquota padrão Lucro Presumido'),
  ('2025.1', 'csll_rate_default',      '{"rate": 0.0288, "note": "9% x 32%"}', '2025-01-01', 'CSLL — alíquota efetiva Lucro Presumido'),
  ('2025.1', 'irpj_rate_default',      '{"rate": 0.048, "note": "15% x 32%"}', '2025-01-01', 'IRPJ — alíquota efetiva Lucro Presumido'),
  ('2025.1', 'holiday_provider',       '{"provider": "date-holidays", "country": "BR", "optional_fiscal": ["Carnaval", "Corpo de Deus"]}', '2025-01-01', 'Feriados usados no cálculo de dias úteis')
ON CONFLICT (ruleset_version, rule_key) DO NOTHING;

-- Seed: ruleset 2025.2 (Sprint 2 — parcelamento IRPJ/CSLL)
INSERT INTO fiscal_rules (ruleset_version, rule_key, rule_value, effective_from, description) VALUES
  ('2025.2', 'parcelamento_quota_minima', '{"value": 1000, "currency": "BRL", "legal_ref": "Lei 9.430/96, art. 5°, §1°"}', '2025-01-01', 'Quota mínima de parcelamento IRPJ/CSLL'),
  ('2025.2', 'parcelamento_max_quotas',   '{"max": 3}',                                                                       '2025-01-01', 'Máximo de quotas permitidas'),
  ('2025.2', 'parcelamento_juros_2a',     '{"formula": "base * 0.01", "note": "0 meses Selic + 1% no mês do pagamento"}',    '2025-01-01', 'Acréscimo 2ª quota — 1%'),
  ('2025.2', 'parcelamento_juros_3a',     '{"formula": "base * (selicMensal + 0.01)", "note": "1 mês Selic + 1% no mês do pagamento"}', '2025-01-01', 'Acréscimo 3ª quota — Selic + 1%'),
  ('2025.2', 'selic_source',             '{"primary": "BACEN SGS 4189", "fallback_aa": 0.1475}',                            '2025-01-01', 'Fonte da taxa Selic para cálculo de juros')
ON CONFLICT (ruleset_version, rule_key) DO NOTHING;

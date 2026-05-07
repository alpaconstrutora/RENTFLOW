-- Faixas históricas do carnê-leão IRPF (tabela progressiva mensal)
-- Fonte: IN RFB / Receita Federal do Brasil
-- A tabela de 2015 ficou congelada até abr/2024 (sem reajuste por 9 anos).

-- 2010 (vigência aproximada jan/2010)
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2010-01-01',    0.00,  1499.15, 0.0000,    0.00),
  ('2010-01-01', 1499.16,  2246.75, 0.0750,  112.43),
  ('2010-01-01', 2246.76,  2995.70, 0.1500,  280.94),
  ('2010-01-01', 2995.71,  3743.19, 0.2250,  505.62),
  ('2010-01-01', 3743.20,     NULL, 0.2750,  692.78)
ON CONFLICT (effective_from, min_income) DO NOTHING;

-- 2011
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2011-01-01',    0.00,  1566.61, 0.0000,    0.00),
  ('2011-01-01', 1566.62,  2347.85, 0.0750,  117.49),
  ('2011-01-01', 2347.86,  3130.51, 0.1500,  293.58),
  ('2011-01-01', 3130.52,  3911.63, 0.2250,  528.37),
  ('2011-01-01', 3911.64,     NULL, 0.2750,  723.95)
ON CONFLICT (effective_from, min_income) DO NOTHING;

-- 2012
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2012-01-01',    0.00,  1637.11, 0.0000,    0.00),
  ('2012-01-01', 1637.12,  2453.50, 0.0750,  122.78),
  ('2012-01-01', 2453.51,  3271.38, 0.1500,  306.80),
  ('2012-01-01', 3271.39,  4087.65, 0.2250,  552.15),
  ('2012-01-01', 4087.66,     NULL, 0.2750,  756.53)
ON CONFLICT (effective_from, min_income) DO NOTHING;

-- 2013
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2013-01-01',    0.00,  1710.78, 0.0000,    0.00),
  ('2013-01-01', 1710.79,  2563.91, 0.0750,  128.31),
  ('2013-01-01', 2563.92,  3418.59, 0.1500,  320.60),
  ('2013-01-01', 3418.60,  4271.59, 0.2250,  577.00),
  ('2013-01-01', 4271.60,     NULL, 0.2750,  790.58)
ON CONFLICT (effective_from, min_income) DO NOTHING;

-- 2014
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2014-01-01',    0.00,  1787.77, 0.0000,    0.00),
  ('2014-01-01', 1787.78,  2679.29, 0.0750,  134.08),
  ('2014-01-01', 2679.30,  3572.43, 0.1500,  335.02),
  ('2014-01-01', 3572.44,  4463.81, 0.2250,  602.96),
  ('2014-01-01', 4463.82,     NULL, 0.2750,  826.15)
ON CONFLICT (effective_from, min_income) DO NOTHING;

-- 2015 → vigente até abr/2024 (tabela congelada por 9 anos)
INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2015-01-01',    0.00,  1903.98, 0.0000,    0.00),
  ('2015-01-01', 1903.99,  2826.65, 0.0750,  142.80),
  ('2015-01-01', 2826.66,  3751.05, 0.1500,  354.80),
  ('2015-01-01', 3751.06,  4664.68, 0.2250,  636.13),
  ('2015-01-01', 4664.69,     NULL, 0.2750,  869.36)
ON CONFLICT (effective_from, min_income) DO NOTHING;
-- Nota: 2024-05-01 já foi semeado em 20260507000001_tax_engine_carne_leao.sql

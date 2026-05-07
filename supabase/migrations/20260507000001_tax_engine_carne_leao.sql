-- ================================================================
-- MIGRAÇÃO: Motor Tributário Carnê-Leão PF (Fase 1)
-- Adiciona: tax_profile, irpf_brackets, tax_deductions
-- Altera:   transactions (withheld_irrf), categories (tax_category),
--           leases (iptu_paid_by, condo_paid_by)
-- RPCs:     recompute_month_irpf, apply_tax_on_payment (dispatcher)
-- Seed:     tabela IRPF 2024, categorias de sistema, perfis existentes
-- ================================================================


-- ─── 1. TABELA tax_profile ──────────────────────────────────────
-- Armazena o regime tributário do usuário. Suporta histórico via
-- effective_from (o regime mais recente vigente no mês é usado).

CREATE TABLE IF NOT EXISTS tax_profile (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  person_type      text NOT NULL CHECK (person_type IN ('pf', 'pj')),
  regime           text NOT NULL CHECK (regime IN ('carne_leao', 'lucro_presumido', 'simples', 'none')),
  effective_from   date NOT NULL DEFAULT '2024-01-01',
  apuration_period text NOT NULL DEFAULT 'monthly' CHECK (apuration_period IN ('monthly', 'annual')),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, person_type, effective_from)
);

ALTER TABLE tax_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_tax_profile" ON tax_profile
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── 2. TABELA irpf_brackets ────────────────────────────────────
-- Faixas progressivas do IRPF mensal (carnê-leão).
-- Suporta múltiplas vigências via effective_from.

CREATE TABLE IF NOT EXISTS irpf_brackets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL,
  min_income     numeric(12,2) NOT NULL DEFAULT 0,
  max_income     numeric(12,2),               -- NULL = sem teto (última faixa)
  rate           numeric(5,4) NOT NULL,        -- 0.075 = 7,5%
  deduction      numeric(12,2) NOT NULL DEFAULT 0,  -- parcela a deduzir em R$
  UNIQUE (effective_from, min_income)
);

ALTER TABLE irpf_brackets ENABLE ROW LEVEL SECURITY;

-- Tabela de sistema: todos os usuários autenticados podem ler
CREATE POLICY "irpf_brackets_read" ON irpf_brackets
  FOR SELECT TO authenticated USING (true);


-- ─── 3. TABELA tax_deductions ────────────────────────────────────
-- Deduções do carnê-leão não cobertas por transações do sistema
-- (ex: plano de saúde, dependentes — Fase 2).
-- Em Fase 1 a tabela é criada mas não populada automaticamente;
-- as deduções são calculadas inline via transactions + categories.

CREATE TABLE IF NOT EXISTS tax_deductions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lease_id       uuid REFERENCES leases ON DELETE SET NULL,
  transaction_id uuid REFERENCES transactions ON DELETE SET NULL,
  billing_month  date NOT NULL,
  amount         numeric(12,2) NOT NULL,
  category       text NOT NULL CHECK (
    category IN ('iptu','condo','admin_fee','commission','maintenance','health','dependent','other')
  ),
  auto_linked    boolean DEFAULT false,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE tax_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_tax_deductions" ON tax_deductions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_tax_deductions_user_month ON tax_deductions (user_id, billing_month);


-- ─── 4. ALTER leases — responsável por IPTU e condomínio ────────
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS iptu_paid_by  text DEFAULT 'tenant'
    CHECK (iptu_paid_by  IN ('landlord', 'tenant')),
  ADD COLUMN IF NOT EXISTS condo_paid_by text DEFAULT 'tenant'
    CHECK (condo_paid_by IN ('landlord', 'tenant'));


-- ─── 5. ALTER transactions — IRRF retido na fonte ───────────────
-- Valor retido pelo pagador (ex: empresa que paga aluguel comercial).
-- É subtraído do carnê-leão do mês para evitar dupla tributação.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS withheld_irrf numeric(12,2) DEFAULT 0;


-- ─── 6. Atualizar transactions_view ─────────────────────────────
DROP VIEW IF EXISTS transactions_view;
CREATE VIEW transactions_view AS
  SELECT
    t.id, t.user_id, t.lease_id, t.property_id, t.category_id, t.type,
    t.amount, t.due_date, t.billing_month, t.paid_date, t.status,
    t.is_auto_generated, t.notes, t.attachment_url, t.recurrence,
    t.recurrence_group_id, t.parent_transaction_id, t.created_at,
    t.updated_at, t.updated_by,
    t.discount_amount, t.addition_amount, t.adjustment_notes,
    (t.amount + COALESCE(t.addition_amount, 0) - COALESCE(t.discount_amount, 0)) AS net_amount,
    t.withheld_irrf,
    t.xmin::text AS xmin,
    p.name AS property_name
  FROM transactions t
  LEFT JOIN properties p ON t.property_id = p.id
  WHERE t.status != 'cancelled';

GRANT SELECT ON transactions_view TO authenticated;


-- ─── 7. ALTER categories — categoria tributária ─────────────────
-- Permite que a RPC identifique despesas dedutíveis no carnê-leão.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS tax_category text CHECK (
    tax_category IN (
      'iptu', 'condo', 'admin_fee', 'commission',
      'maintenance', 'tax_expense', 'none'
    )
  );


-- ─── 8. SEED: faixas IRPF mensais vigentes a partir de mai/2024 ──
-- Fonte: IN RFB 2.178/2024 — tabela progressiva do carnê-leão.
-- A parcela a deduzir converte o cálculo em alíquota efetiva simples:
--   imposto = base × rate - deduction

INSERT INTO irpf_brackets (effective_from, min_income, max_income, rate, deduction) VALUES
  ('2024-05-01',    0.00,  2259.20, 0.0000,    0.00),
  ('2024-05-01', 2259.21,  2826.65, 0.0750,  169.44),
  ('2024-05-01', 2826.66,  3751.05, 0.1500,  381.44),
  ('2024-05-01', 3751.06,  4664.68, 0.2250,  662.77),
  ('2024-05-01', 4664.69,     NULL, 0.2750,  896.00)
ON CONFLICT (effective_from, min_income) DO NOTHING;


-- ─── 9. SEED: tax_category nas categorias de sistema ─────────────

UPDATE categories SET tax_category = 'iptu'        WHERE name = 'IPTU'                 AND is_system = true;
UPDATE categories SET tax_category = 'condo'       WHERE name = 'Condomínio'            AND is_system = true;
UPDATE categories SET tax_category = 'admin_fee'   WHERE name = 'Taxa de administração' AND is_system = true;
UPDATE categories SET tax_category = 'maintenance' WHERE name = 'Manutenção'            AND is_system = true;
UPDATE categories SET tax_category = 'none'        WHERE name IN ('Aluguel','Multa por atraso','Caução','Seguro','Reforma','Outros') AND is_system = true;

-- Categoria de sistema para lançamento do carnê-leão
INSERT INTO categories (name, type, is_system, tax_category)
SELECT 'Carnê-leão IRPF', 'expense', true, 'tax_expense'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Carnê-leão IRPF' AND is_system = true);


-- ─── 10. MIGRAÇÃO DE DADOS: tax_profile para usuários existentes ─
-- Todos os usuários atuais recebem perfil PF + carnê-leão.
-- O usuário pode alterar o regime na tela de Impostos.

INSERT INTO tax_profile (user_id, person_type, regime, effective_from)
SELECT id, 'pf', 'carne_leao', '2024-01-01'
FROM auth.users
ON CONFLICT (user_id, person_type, effective_from) DO NOTHING;


-- ─── 11. RPC: recompute_month_irpf ───────────────────────────────
-- Padrão "recompute on each event":
--   1. Cancela lançamentos IRPF auto-gerados pendentes do mês
--   2. Soma receitas pagas no mês (regime de caixa: paid_date)
--   3. Soma deduções do mês (despesas pagas com tax_category dedutível
--      + tax_deductions manuais)
--   4. Aplica faixa progressiva → imposto bruto
--   5. Subtrai IRRF já retido na fonte
--   6. Cria único lançamento pendente com o valor líquido a recolher

CREATE OR REPLACE FUNCTION recompute_month_irpf(
  p_user_id       uuid,
  p_billing_month date
)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_regime             text;
  v_billing_trunc      date;
  v_gross_income       numeric := 0;
  v_withheld_irrf      numeric := 0;
  v_deductions_tx      numeric := 0;
  v_deductions_manual  numeric := 0;
  v_total_deductions   numeric := 0;
  v_net_base           numeric := 0;
  v_rate               numeric;
  v_deduction_val      numeric;
  v_tax_gross          numeric := 0;
  v_irpf_to_pay        numeric := 0;
  v_category_id        uuid;
  v_property_id        uuid;
  v_due_date           date;
BEGIN
  -- Segurança: só o próprio usuário pode chamar
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  v_billing_trunc := DATE_TRUNC('month', p_billing_month)::date;

  -- Verificar regime ativo para o mês
  SELECT regime INTO v_regime
  FROM tax_profile
  WHERE user_id      = p_user_id
    AND person_type  = 'pf'
    AND effective_from <= v_billing_trunc
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_regime IS DISTINCT FROM 'carne_leao' THEN
    RETURN 0;
  END IF;

  -- 1. Cancelar lançamentos IRPF auto-gerados pendentes do mês
  UPDATE transactions
    SET status = 'cancelled'
  WHERE user_id         = p_user_id
    AND billing_month   = v_billing_trunc
    AND is_auto_generated = true
    AND status          = 'pending'
    AND notes LIKE '%Carnê-leão IRPF%';

  -- 2. Somar receitas pagas no mês (regime de caixa: paid_date)
  SELECT
    COALESCE(SUM(t.amount + COALESCE(t.addition_amount,0) - COALESCE(t.discount_amount,0)), 0),
    COALESCE(SUM(COALESCE(t.withheld_irrf, 0)), 0)
  INTO v_gross_income, v_withheld_irrf
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.type    = 'income'
    AND t.status  = 'paid'
    AND DATE_TRUNC('month', t.paid_date) = v_billing_trunc;

  IF v_gross_income = 0 THEN
    RETURN 0;
  END IF;

  -- 3a. Somar deduções via despesas pagas com category dedutível
  --     (IPTU, condomínio, adm, comissão, manutenção)
  SELECT COALESCE(SUM(t.amount + COALESCE(t.addition_amount,0) - COALESCE(t.discount_amount,0)), 0)
  INTO v_deductions_tx
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.type    = 'expense'
    AND t.status  = 'paid'
    AND DATE_TRUNC('month', t.paid_date) = v_billing_trunc
    AND c.tax_category IN ('iptu','condo','admin_fee','commission','maintenance');

  -- 3b. Somar deduções manuais (plano de saúde, dependentes — Fase 2)
  SELECT COALESCE(SUM(d.amount), 0)
  INTO v_deductions_manual
  FROM tax_deductions d
  WHERE d.user_id      = p_user_id
    AND d.billing_month = v_billing_trunc;

  v_total_deductions := v_deductions_tx + v_deductions_manual;
  v_net_base := GREATEST(0, v_gross_income - v_total_deductions);

  IF v_net_base = 0 THEN
    RETURN 0;
  END IF;

  -- 4. Aplicar faixa progressiva vigente no mês
  SELECT rate, deduction INTO v_rate, v_deduction_val
  FROM irpf_brackets
  WHERE effective_from <= v_billing_trunc
    AND min_income     <= v_net_base
    AND (max_income IS NULL OR max_income >= v_net_base)
  ORDER BY effective_from DESC, min_income DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    RETURN 0;  -- base abaixo do mínimo (isento)
  END IF;

  v_tax_gross  := ROUND(v_net_base * v_rate - v_deduction_val, 2);
  v_irpf_to_pay := GREATEST(0, v_tax_gross - v_withheld_irrf);

  IF v_irpf_to_pay <= 0 THEN
    RETURN 0;
  END IF;

  -- 5. Resolver categoria e imóvel para o lançamento
  SELECT id INTO v_category_id
  FROM categories
  WHERE name = 'Carnê-leão IRPF' AND is_system = true
  LIMIT 1;

  SELECT t.property_id INTO v_property_id
  FROM transactions t
  WHERE t.user_id = p_user_id
    AND t.type    = 'income'
    AND t.status  = 'paid'
    AND DATE_TRUNC('month', t.paid_date) = v_billing_trunc
  ORDER BY t.amount DESC
  LIMIT 1;

  -- Vencimento: último dia do mês seguinte ao fato gerador (prazo legal do DARF)
  v_due_date := (DATE_TRUNC('month', v_billing_trunc) + INTERVAL '2 months' - INTERVAL '1 day')::date;

  -- 6. Criar lançamento único de carnê-leão
  INSERT INTO transactions (
    user_id, property_id, category_id, type, amount,
    billing_month, due_date, status, is_auto_generated, notes
  ) VALUES (
    p_user_id,
    v_property_id,
    v_category_id,
    'expense',
    v_irpf_to_pay,
    v_billing_trunc,
    v_due_date,
    'pending',
    true,
    format(
      'Carnê-leão IRPF %s/%s — Base: R$ %s | Alíquota: %s%% | IRRF retido: R$ %s | Deduções: R$ %s',
      LPAD(EXTRACT(MONTH FROM v_billing_trunc)::text, 2, '0'),
      EXTRACT(YEAR  FROM v_billing_trunc)::int,
      TO_CHAR(v_net_base,     'FM999G999G990D00'),
      ROUND(v_rate * 100, 1),
      TO_CHAR(v_withheld_irrf,'FM999G999G990D00'),
      TO_CHAR(v_total_deductions,'FM999G999G990D00')
    )
  );

  RETURN v_irpf_to_pay;
END; $$;

GRANT EXECUTE ON FUNCTION recompute_month_irpf(uuid, date) TO authenticated;


-- ─── 12. Atualizar apply_tax_on_payment — dispatcher ─────────────
-- Se usuário tem regime carnê-leão → recomputa IRPF do mês.
-- Caso contrário → caminho legado IBS/CBS.

CREATE OR REPLACE FUNCTION apply_tax_on_payment(
  p_transaction_id uuid,
  p_user_id        uuid
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_tx             RECORD;
  v_regime         text;
  v_billing_month  date;
  v_irpf_amount    numeric;
  -- variáveis IBS/CBS (caminho legado)
  v_tax_config     RECORD;
  v_property_type  text;
  v_net_value      numeric;
  v_tax_base       numeric;
  v_total_rate     numeric;
  v_tax_amount     numeric;
BEGIN
  -- Buscar transação com net_amount
  SELECT t.type, t.amount,
         t.amount + COALESCE(t.addition_amount,0) - COALESCE(t.discount_amount,0) AS net_amount,
         t.property_id, t.status, t.due_date, t.lease_id, t.paid_date
  INTO v_tx
  FROM transactions t
  WHERE t.id = p_transaction_id AND t.user_id = p_user_id;

  IF v_tx IS NULL THEN RETURN 0; END IF;
  IF v_tx.type != 'income' OR v_tx.status != 'paid' THEN RETURN 0; END IF;

  v_billing_month := DATE_TRUNC('month', COALESCE(v_tx.paid_date, v_tx.due_date))::date;

  -- Verificar regime tributário do usuário
  SELECT regime INTO v_regime
  FROM tax_profile
  WHERE user_id      = p_user_id
    AND person_type  = 'pf'
    AND effective_from <= v_billing_month
  ORDER BY effective_from DESC
  LIMIT 1;

  -- ── Caminho carnê-leão ──────────────────────────────────────
  IF v_regime = 'carne_leao' THEN
    SELECT recompute_month_irpf(p_user_id, v_billing_month) INTO v_irpf_amount;
    RETURN COALESCE(v_irpf_amount, 0);
  END IF;

  -- ── Caminho legado: IBS/CBS ─────────────────────────────────
  SELECT p.type AS property_type INTO v_property_type
  FROM leases l JOIN properties p ON l.property_id = p.id
  WHERE l.id = v_tx.lease_id;

  v_net_value     := COALESCE(v_tx.net_amount, v_tx.amount);
  v_property_type := COALESCE(v_property_type, 'commercial');

  SELECT ibs_rate, cbs_rate, residential_deduction INTO v_tax_config
  FROM tax_config WHERE user_id = p_user_id;

  IF v_tax_config IS NULL THEN RETURN 0; END IF;

  IF v_property_type = 'residential' THEN
    v_tax_base := v_net_value * (1 - COALESCE(v_tax_config.residential_deduction, 0.50));
  ELSE
    v_tax_base := v_net_value;
  END IF;

  v_total_rate := COALESCE(v_tax_config.ibs_rate, 0.0065) + COALESCE(v_tax_config.cbs_rate, 0.0090);
  v_tax_amount := ROUND(v_tax_base * v_total_rate, 2);

  IF v_tax_amount <= 0 THEN RETURN 0; END IF;

  INSERT INTO transactions (
    user_id, property_id, type, amount, due_date,
    billing_month, status, is_auto_generated, notes
  ) VALUES (
    p_user_id, v_tx.property_id, 'expense', v_tax_amount, v_tx.due_date,
    DATE_TRUNC('month', v_tx.due_date)::date, 'pending', true,
    format('IBS/CBS retidos automaticamente (%s%% sobre %s - Valor Líquido Recebido)',
      ROUND(v_total_rate * 100, 2),
      CASE WHEN v_property_type = 'residential'
        THEN 'base residencial deduzida' ELSE 'base integral' END
    )
  );

  RETURN v_tax_amount;
END; $$;

GRANT EXECUTE ON FUNCTION apply_tax_on_payment(uuid, uuid) TO authenticated;

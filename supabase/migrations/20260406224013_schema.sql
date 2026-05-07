-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLES

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name          text,
  phone         text,
  plan          text DEFAULT 'trial',
  trial_ends_at timestamptz,
  timezone      text DEFAULT 'America/Sao_Paulo',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  purchase_value numeric(12,2),
  expected_rent  numeric(12,2),
  type           text CHECK (type IN ('residential','commercial')),
  status         text CHECK (status IN ('rented','vacant')) DEFAULT 'vacant',
  address        text,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  email      text,
  phone      text,
  document   text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE leases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties ON DELETE CASCADE NOT NULL,
  tenant_id   uuid REFERENCES tenants ON DELETE RESTRICT NOT NULL,
  rent_value  numeric(12,2) NOT NULL,
  due_day     int CHECK (due_day BETWEEN 1 AND 31),
  start_date  date NOT NULL,
  end_date    date,
  active      boolean DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE rent_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id        uuid REFERENCES leases ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  previous_value  numeric(12,2) NOT NULL,
  new_value       numeric(12,2) NOT NULL,
  index_used      text,
  adjustment_date date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid REFERENCES auth.users ON DELETE CASCADE, -- NULL = system
  name      text NOT NULL,
  type      text CHECK (type IN ('income','expense')),
  is_system boolean DEFAULT false
);

CREATE TABLE transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  lease_id              uuid REFERENCES leases ON DELETE SET NULL,
  property_id           uuid REFERENCES properties ON DELETE CASCADE NOT NULL,
  category_id           uuid REFERENCES categories ON DELETE SET NULL,
  type                  text CHECK (type IN ('income','expense')) NOT NULL,
  amount                numeric(12,2) NOT NULL,
  due_date              date NOT NULL,
  billing_month         date NOT NULL,
  paid_date             date,
  status                text CHECK (status IN ('pending','paid','late','cancelled')) DEFAULT 'pending',
  is_auto_generated     boolean DEFAULT false,
  recurrence            text CHECK (recurrence IN ('none','monthly','annual')) DEFAULT 'none',
  recurrence_day        int,
  recurrence_start_date date,
  recurrence_end_date   date,
  recurrence_group_id   uuid,
  notes                 text,
  attachment_url        text,
  parent_transaction_id uuid REFERENCES transactions ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  updated_by            uuid REFERENCES auth.users ON DELETE SET NULL
);

CREATE TABLE tax_config (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  ibs_rate                 numeric(5,4) DEFAULT 0.0065,
  cbs_rate                 numeric(5,4) DEFAULT 0.0090,
  exemption_revenue_limit  numeric(12,2) DEFAULT 120000,
  exemption_property_count int DEFAULT 3,
  residential_deduction    numeric(5,4) DEFAULT 0.50,
  updated_at               timestamptz DEFAULT now()
);

CREATE TABLE job_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      text NOT NULL,
  run_at        timestamptz DEFAULT now(),
  status        text CHECK (status IN ('running','success','failed','aborted')),
  rows_affected int,
  error_message text,
  duration_ms   int
);

CREATE TABLE domain_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users ON DELETE CASCADE,
  event_type    text NOT NULL,
  event_version int DEFAULT 1,
  source        text CHECK (source IN ('system','user','job')) NOT NULL DEFAULT 'system',
  payload       jsonb NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- 2. CONSTRAINTS

CREATE UNIQUE INDEX uq_lease_billing_month ON transactions (lease_id, billing_month)
  WHERE is_auto_generated = true;

ALTER TABLE transactions
  ADD CONSTRAINT check_income_requires_lease CHECK (type != 'income' OR lease_id IS NOT NULL);

ALTER TABLE transactions
  ADD CONSTRAINT check_recurrence_group CHECK (recurrence = 'none' OR recurrence_group_id IS NOT NULL);


-- 3. INDEXES
CREATE INDEX idx_transactions_user_status_month ON transactions (user_id, status, billing_month);
CREATE INDEX idx_transactions_user_due ON transactions (user_id, due_date) WHERE status IN ('pending', 'late');
CREATE INDEX idx_transactions_lease_month ON transactions (lease_id, billing_month);
CREATE INDEX idx_transactions_property_month ON transactions (property_id, billing_month);

-- 4. VIEW OBRIGATÓRIA E ENFORCED ACCESS (V6 INVARIANT 13)
CREATE VIEW active_transactions AS
  SELECT * FROM transactions
  WHERE status != 'cancelled';

REVOKE SELECT ON transactions FROM authenticated;
GRANT SELECT ON active_transactions TO authenticated;


-- 5. FUNCTION USER_TODAY E FUNCTIONS AUXILIARES
CREATE OR REPLACE FUNCTION user_today(p_user_id uuid)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date
  FROM profiles WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_plan_limit(p_user_id uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT CASE plan
    WHEN 'trial' THEN 999
    WHEN 'basic' THEN 5
    WHEN 'pro'   THEN 20
    ELSE 0
  END FROM profiles WHERE id = p_user_id;
$$;


-- 6. TRIGGERS

CREATE OR REPLACE FUNCTION sync_property_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE properties
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM leases
      WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
        AND active = true
    ) THEN 'rented' ELSE 'vacant'
  END
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_property_status
AFTER INSERT OR UPDATE OR DELETE ON leases
FOR EACH ROW EXECUTE FUNCTION sync_property_status();


CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_transactions_audit
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE OR REPLACE FUNCTION check_property_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM properties WHERE user_id = NEW.user_id)
     >= get_plan_limit(NEW.user_id)
  THEN
    RAISE EXCEPTION 'plan_limit_exceeded'
      USING DETAIL = 'Limite de imóveis do plano atingido.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_check_property_limit
BEFORE INSERT ON properties
FOR EACH ROW EXECUTE FUNCTION check_property_limit();


-- 7. LOCKS ADVISORY (V6)
CREATE OR REPLACE FUNCTION try_acquire_job_lock(p_job_name text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_acquired boolean;
BEGIN
  SELECT pg_try_advisory_lock(hashtext(p_job_name)) INTO v_acquired;
  RETURN v_acquired;
END; $$;

CREATE OR REPLACE FUNCTION release_job_lock(p_job_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext(p_job_name));
END; $$;


-- 8. BUSINESS DOMAIN FUNCTIONS
CREATE OR REPLACE FUNCTION generate_monthly_rents()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO transactions (
    user_id, lease_id, property_id, type, amount,
    billing_month, due_date, status, is_auto_generated
  )
  SELECT l.user_id, l.id, l.property_id, 'income', l.rent_value,
    DATE_TRUNC('month', CURRENT_DATE),
    MAKE_DATE(
      EXTRACT(YEAR  FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(l.due_day, EXTRACT(DAY FROM
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::int)
    ), 'pending', true
  FROM leases l WHERE l.active = true
  ON CONFLICT (lease_id, billing_month)
    WHERE is_auto_generated = true
  DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;


CREATE OR REPLACE FUNCTION generate_recurring_expenses()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO transactions (
    user_id, property_id, category_id, type, amount,
    billing_month, due_date, status, recurrence, recurrence_day,
    recurrence_group_id, recurrence_start_date, recurrence_end_date
  )
  SELECT DISTINCT ON (recurrence_group_id)
    t.user_id, t.property_id, t.category_id, t.type, t.amount,
    DATE_TRUNC('month', CURRENT_DATE),
    MAKE_DATE(
      EXTRACT(YEAR  FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      LEAST(t.recurrence_day, EXTRACT(DAY FROM
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::int)
    ), 'pending', t.recurrence, t.recurrence_day,
    t.recurrence_group_id, t.recurrence_start_date, t.recurrence_end_date
  FROM transactions t
  WHERE t.recurrence = 'monthly'
    AND t.status != 'cancelled'
    AND (t.recurrence_end_date IS NULL
         OR t.recurrence_end_date >= DATE_TRUNC('month', CURRENT_DATE))
    AND NOT EXISTS (
      SELECT 1 FROM transactions t2
      WHERE t2.recurrence_group_id = t.recurrence_group_id
        AND t2.billing_month = DATE_TRUNC('month', CURRENT_DATE)
    )
  ORDER BY recurrence_group_id, t.billing_month DESC;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION recompute_statuses(p_user_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
  WITH recomputed AS (
    UPDATE transactions t SET status =
      CASE
        WHEN t.paid_date IS NOT NULL THEN 'paid'
        WHEN t.due_date >= user_today(t.user_id) THEN 'pending'
        ELSE 'late'
      END
    WHERE t.user_id = p_user_id
      AND t.status != 'cancelled'
      AND t.status != CASE
        WHEN t.paid_date IS NOT NULL THEN 'paid'
        WHEN t.due_date >= user_today(t.user_id) THEN 'pending'
        ELSE 'late'
      END
    RETURNING t.id
  )
  SELECT COUNT(*) INTO v_count FROM recomputed;
  RETURN v_count;
END; $$;


-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation_profiles" ON profiles USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "user_isolation_properties" ON properties USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation_tenants" ON tenants USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation_leases" ON leases USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation_rent_history" ON rent_history USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation_transactions" ON transactions USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_isolation_tax_config" ON tax_config USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "categories_read" ON categories FOR SELECT USING (is_system = true OR user_id = auth.uid());
CREATE POLICY "categories_write" ON categories FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- 10. CATEGORIAS DE SISTEMA DEFAULT
INSERT INTO categories (name, type, is_system) VALUES 
('Aluguel', 'income', true),
('Multa por atraso', 'income', true),
('Caução', 'income', true),
('Manutenção', 'expense', true),
('IPTU', 'expense', true),
('Condomínio', 'expense', true),
('Seguro', 'expense', true),
('Taxa de administração', 'expense', true),
('Reforma', 'expense', true),
('Outros', 'expense', true);

-- Adiciona tenant_name à transactions_view via LEFT JOIN leases → tenants
-- Transações de despesa (sem lease_id) retornam NULL — tratado na UI

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
    t.xmin::text AS xmin,
    p.name  AS property_name,
    ten.name AS tenant_name
  FROM transactions t
  LEFT JOIN properties p   ON t.property_id = p.id
  LEFT JOIN leases     l   ON t.lease_id    = l.id
  LEFT JOIN tenants    ten ON l.tenant_id   = ten.id
  WHERE t.status != 'cancelled';

GRANT SELECT ON transactions_view TO authenticated;

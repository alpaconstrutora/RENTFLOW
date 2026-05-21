-- RPC: get_property_profit_summary
-- Substitui o fetch de todas as transações pagas no client com um GROUP BY no banco.
-- Retorna lucro líquido acumulado e quantidade de meses distintos por imóvel.
-- SECURITY INVOKER → herda RLS do chamador (usuário só vê os próprios dados).

CREATE OR REPLACE FUNCTION get_property_profit_summary()
RETURNS TABLE (
  property_id   uuid,
  total_profit  numeric,
  months_count  integer
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    property_id,
    SUM(CASE WHEN type = 'income' THEN net_amount ELSE -net_amount END) AS total_profit,
    COUNT(DISTINCT billing_month)::integer                               AS months_count
  FROM transactions_view
  WHERE status      = 'paid'
    AND property_id IS NOT NULL
  GROUP BY property_id;
$$;

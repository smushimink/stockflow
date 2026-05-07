-- Add profit columns to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gross_profit_lifetime NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_profit_90d      NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_margin_pct        NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS payment_terms_days    INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS avg_dso_days          NUMERIC(8,2);

-- ============================================================
-- Updated recalculate_customer_metrics — adds profit columns
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_customer_metrics(p_org_id UUID)
RETURNS void AS $$
BEGIN
  WITH order_gaps AS (
    SELECT
      customer_id,
      ordered_at,
      LAG(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at) AS prev_ordered_at
    FROM sales_orders
    WHERE organization_id = p_org_id
      AND status = 'completed'
      AND customer_id IS NOT NULL
  ),
  intervals AS (
    SELECT
      customer_id,
      EXTRACT(epoch FROM (ordered_at - prev_ordered_at)) / 86400.0 AS gap_days
    FROM order_gaps
    WHERE prev_ordered_at IS NOT NULL
  ),
  avg_intervals AS (
    SELECT customer_id, AVG(gap_days) AS avg_interval
    FROM intervals
    GROUP BY customer_id
    HAVING COUNT(*) >= 2
  ),
  stats AS (
    SELECT
      customer_id,
      COUNT(*)::INTEGER AS total_orders,
      SUM(total)        AS total_spent,
      MAX(ordered_at)   AS last_order_at
    FROM sales_orders
    WHERE organization_id = p_org_id
      AND status = 'completed'
      AND customer_id IS NOT NULL
    GROUP BY customer_id
  ),
  profit_stats AS (
    SELECT
      so.customer_id,
      SUM(soi.qty * soi.unit_price - soi.qty * soi.unit_cost - soi.discount) AS gross_profit_lifetime,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days'
          THEN soi.qty * soi.unit_price - soi.qty * soi.unit_cost - soi.discount
          ELSE 0 END) AS gross_profit_90d
    FROM sales_orders so
    JOIN sales_order_items soi ON soi.order_id = so.id
    WHERE so.organization_id = p_org_id
      AND so.status = 'completed'
      AND so.customer_id IS NOT NULL
    GROUP BY so.customer_id
  )
  UPDATE customers c
  SET
    total_orders            = s.total_orders,
    total_spent             = s.total_spent,
    last_order_at           = s.last_order_at,
    avg_order_interval_days = ai.avg_interval,
    gross_profit_lifetime   = COALESCE(ps.gross_profit_lifetime, 0),
    gross_profit_90d        = COALESCE(ps.gross_profit_90d, 0),
    avg_margin_pct          = CASE
                                WHEN s.total_spent > 0
                                  THEN COALESCE(ps.gross_profit_lifetime, 0) / s.total_spent
                                ELSE NULL
                              END,
    updated_at              = NOW()
  FROM stats s
  LEFT JOIN avg_intervals ai ON ai.customer_id = s.customer_id
  LEFT JOIN profit_stats  ps ON ps.customer_id = s.customer_id
  WHERE c.id = s.customer_id
    AND c.organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

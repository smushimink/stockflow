-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_metrics_org_revenue
  ON product_metrics(organization_id, revenue_90d DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_org_status_severity
  ON decision_alerts(organization_id, status, severity);

-- ============================================================
-- Updated calculate_product_metrics
-- Changes from 0003:
--   - No longer depends on the materialized view (always fresh)
--   - All-time last_sale_at (not capped at 90 days)
--   - avg_discount from last 90d sales_order_items
--   - avg_platform_fee placeholder (0 until integrations)
--   - real_margin_pct includes avg_discount
--   - days_of_cover uses 30d velocity (spec requirement)
--   - Processes ALL products (not just active)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_product_metrics(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO product_metrics (
    organization_id, product_id, calculated_at,
    avg_daily_sales_7d, avg_daily_sales_30d, avg_daily_sales_90d,
    days_of_cover, days_since_last_sale, last_sale_at,
    revenue_90d, units_sold_90d,
    real_unit_cost, avg_discount, avg_platform_fee, real_margin_pct,
    cash_tied_up
  )
  WITH
  velocity AS (
    SELECT
      soi.product_id,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '7 days'  THEN soi.qty ELSE 0 END) / 7.0  AS avg_7d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '30 days' THEN soi.qty ELSE 0 END) / 30.0 AS avg_30d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.qty ELSE 0 END) / 90.0 AS avg_90d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.total ELSE 0 END)          AS revenue_90d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.qty   ELSE 0 END)::INTEGER AS units_90d
    FROM sales_order_items soi
    JOIN sales_orders so ON so.id = soi.order_id
    WHERE soi.organization_id = p_org_id
      AND so.status = 'completed'
      AND soi.product_id IS NOT NULL
    GROUP BY soi.product_id
  ),
  last_sale AS (
    SELECT soi.product_id, MAX(so.ordered_at) AS last_sale_at
    FROM sales_order_items soi
    JOIN sales_orders so ON so.id = soi.order_id
    WHERE soi.organization_id = p_org_id
      AND so.status = 'completed'
      AND soi.product_id IS NOT NULL
    GROUP BY soi.product_id
  ),
  discounts AS (
    SELECT
      soi.product_id,
      CASE WHEN SUM(soi.qty) > 0
        THEN SUM(soi.discount) / SUM(soi.qty)
        ELSE 0
      END AS avg_discount
    FROM sales_order_items soi
    JOIN sales_orders so ON so.id = soi.order_id
    WHERE soi.organization_id = p_org_id
      AND so.status = 'completed'
      AND so.ordered_at >= NOW() - INTERVAL '90 days'
      AND soi.product_id IS NOT NULL
    GROUP BY soi.product_id
  )
  SELECT
    p.organization_id,
    p.id                                                            AS product_id,
    NOW()                                                           AS calculated_at,

    COALESCE(v.avg_7d, 0)                                          AS avg_daily_sales_7d,
    COALESCE(v.avg_30d, 0)                                         AS avg_daily_sales_30d,
    COALESCE(v.avg_90d, 0)                                         AS avg_daily_sales_90d,

    CASE
      WHEN COALESCE(v.avg_30d, 0) > 0
        THEN LEAST(9999, p.stock_on_hand / v.avg_30d)
      ELSE 9999
    END                                                             AS days_of_cover,

    CASE
      WHEN ls.last_sale_at IS NOT NULL
        THEN (EXTRACT(epoch FROM (NOW() - ls.last_sale_at)) / 86400.0)::INTEGER
      ELSE NULL
    END                                                             AS days_since_last_sale,

    ls.last_sale_at,

    COALESCE(v.revenue_90d, 0)                                     AS revenue_90d,
    COALESCE(v.units_90d, 0)                                       AS units_sold_90d,

    p.unit_cost                                                     AS real_unit_cost,
    COALESCE(d.avg_discount, 0)                                     AS avg_discount,
    0                                                               AS avg_platform_fee,

    CASE
      WHEN p.selling_price > 0
        THEN (p.selling_price - p.unit_cost - COALESCE(d.avg_discount, 0)) / p.selling_price
      ELSE 0
    END                                                             AS real_margin_pct,

    p.stock_on_hand * p.unit_cost                                   AS cash_tied_up

  FROM products p
  LEFT JOIN velocity v  ON v.product_id  = p.id
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  LEFT JOIN discounts d  ON d.product_id  = p.id
  WHERE p.organization_id = p_org_id

  ON CONFLICT (organization_id, product_id) DO UPDATE SET
    calculated_at       = EXCLUDED.calculated_at,
    avg_daily_sales_7d  = EXCLUDED.avg_daily_sales_7d,
    avg_daily_sales_30d = EXCLUDED.avg_daily_sales_30d,
    avg_daily_sales_90d = EXCLUDED.avg_daily_sales_90d,
    days_of_cover       = EXCLUDED.days_of_cover,
    days_since_last_sale= EXCLUDED.days_since_last_sale,
    last_sale_at        = EXCLUDED.last_sale_at,
    revenue_90d         = EXCLUDED.revenue_90d,
    units_sold_90d      = EXCLUDED.units_sold_90d,
    real_unit_cost      = EXCLUDED.real_unit_cost,
    avg_discount        = EXCLUDED.avg_discount,
    avg_platform_fee    = EXCLUDED.avg_platform_fee,
    real_margin_pct     = EXCLUDED.real_margin_pct,
    cash_tied_up        = EXCLUDED.cash_tied_up;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ABC classification
-- Sorts products by revenue_90d, cumulative 80/95/100 → A/B/C
-- Syncs to both product_metrics.abc_class and products.abc_class
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_abc(p_org_id UUID)
RETURNS void AS $$
BEGIN
  WITH ranked AS (
    SELECT
      product_id,
      revenue_90d,
      COALESCE(SUM(revenue_90d) OVER (), 0) AS total_revenue,
      SUM(revenue_90d) OVER (
        ORDER BY revenue_90d DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_revenue
    FROM product_metrics
    WHERE organization_id = p_org_id
  ),
  classified AS (
    SELECT
      product_id,
      CASE
        WHEN total_revenue = 0 OR revenue_90d = 0       THEN 'C'
        WHEN cumulative_revenue / total_revenue <= 0.80 THEN 'A'
        WHEN cumulative_revenue / total_revenue <= 0.95 THEN 'B'
        ELSE 'C'
      END AS abc_class
    FROM ranked
  )
  UPDATE product_metrics pm
  SET abc_class = c.abc_class
  FROM classified c
  WHERE pm.product_id = c.product_id
    AND pm.organization_id = p_org_id;

  UPDATE products p
  SET abc_class = pm.abc_class
  FROM product_metrics pm
  WHERE p.id = pm.product_id
    AND p.organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Customer metrics rollup
-- Updates customers.total_orders, total_spent, last_order_at,
-- avg_order_interval_days (only when >= 3 orders)
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
    HAVING COUNT(*) >= 2  -- >= 2 gaps means >= 3 orders
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
  )
  UPDATE customers c
  SET
    total_orders            = s.total_orders,
    total_spent             = s.total_spent,
    last_order_at           = s.last_order_at,
    avg_order_interval_days = ai.avg_interval,
    updated_at              = NOW()
  FROM stats s
  LEFT JOIN avg_intervals ai ON ai.customer_id = s.customer_id
  WHERE c.id = s.customer_id
    AND c.organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

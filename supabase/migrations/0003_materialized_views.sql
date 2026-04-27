-- Materialized view: daily sales by SKU (last 90 days)
CREATE MATERIALIZED VIEW mv_daily_sales_by_sku AS
SELECT
  soi.organization_id,
  soi.product_id,
  soi.sku,
  DATE_TRUNC('day', so.ordered_at)::DATE AS sale_date,
  SUM(soi.qty) AS units_sold,
  SUM(soi.total) AS revenue,
  SUM(soi.qty * soi.unit_cost) AS cogs
FROM sales_order_items soi
JOIN sales_orders so ON so.id = soi.order_id
WHERE so.status = 'completed'
  AND so.ordered_at >= NOW() - INTERVAL '90 days'
GROUP BY soi.organization_id, soi.product_id, soi.sku, DATE_TRUNC('day', so.ordered_at)::DATE;

CREATE UNIQUE INDEX idx_mv_daily_sales ON mv_daily_sales_by_sku(organization_id, product_id, sale_date);
CREATE INDEX idx_mv_daily_sales_sku ON mv_daily_sales_by_sku(organization_id, sku);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_mv_daily_sales()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_by_sku;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate and upsert product metrics for an org
CREATE OR REPLACE FUNCTION calculate_product_metrics(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO product_metrics (
    organization_id, product_id,
    avg_daily_sales_7d, avg_daily_sales_30d, avg_daily_sales_90d,
    days_of_cover, days_since_last_sale, last_sale_at,
    revenue_90d, units_sold_90d,
    real_unit_cost, real_margin_pct,
    cash_tied_up, calculated_at
  )
  SELECT
    p.organization_id,
    p.id AS product_id,

    COALESCE(
      SUM(CASE WHEN mv.sale_date >= CURRENT_DATE - 7 THEN mv.units_sold ELSE 0 END) / 7.0,
      0
    ) AS avg_daily_sales_7d,

    COALESCE(
      SUM(CASE WHEN mv.sale_date >= CURRENT_DATE - 30 THEN mv.units_sold ELSE 0 END) / 30.0,
      0
    ) AS avg_daily_sales_30d,

    COALESCE(
      SUM(mv.units_sold) / 90.0,
      0
    ) AS avg_daily_sales_90d,

    CASE
      WHEN COALESCE(SUM(mv.units_sold) / 90.0, 0) > 0
        THEN p.stock_on_hand / (COALESCE(SUM(mv.units_sold) / 90.0, 0))
      ELSE 9999
    END AS days_of_cover,

    CASE
      WHEN MAX(mv.sale_date) IS NOT NULL
        THEN (CURRENT_DATE - MAX(mv.sale_date))
      ELSE NULL
    END AS days_since_last_sale,

    MAX(mv.sale_date)::TIMESTAMPTZ AS last_sale_at,

    COALESCE(SUM(mv.revenue), 0) AS revenue_90d,
    COALESCE(SUM(mv.units_sold), 0)::INTEGER AS units_sold_90d,

    p.unit_cost AS real_unit_cost,
    CASE
      WHEN p.selling_price > 0
        THEN (p.selling_price - p.unit_cost) / p.selling_price
      ELSE 0
    END AS real_margin_pct,

    p.stock_on_hand * p.unit_cost AS cash_tied_up,

    NOW() AS calculated_at

  FROM products p
  LEFT JOIN mv_daily_sales_by_sku mv ON mv.product_id = p.id
  WHERE p.organization_id = p_org_id
    AND p.status = 'active'
  GROUP BY p.id, p.organization_id, p.stock_on_hand, p.unit_cost, p.selling_price

  ON CONFLICT (organization_id, product_id) DO UPDATE SET
    avg_daily_sales_7d = EXCLUDED.avg_daily_sales_7d,
    avg_daily_sales_30d = EXCLUDED.avg_daily_sales_30d,
    avg_daily_sales_90d = EXCLUDED.avg_daily_sales_90d,
    days_of_cover = EXCLUDED.days_of_cover,
    days_since_last_sale = EXCLUDED.days_since_last_sale,
    last_sale_at = EXCLUDED.last_sale_at,
    revenue_90d = EXCLUDED.revenue_90d,
    units_sold_90d = EXCLUDED.units_sold_90d,
    real_unit_cost = EXCLUDED.real_unit_cost,
    real_margin_pct = EXCLUDED.real_margin_pct,
    cash_tied_up = EXCLUDED.cash_tied_up,
    calculated_at = EXCLUDED.calculated_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default decision rules for a new org
CREATE OR REPLACE FUNCTION seed_default_rules(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO decision_rules (organization_id, rule_type, name, description, enabled, config) VALUES
    (p_org_id, 'reorder', 'Reorder Point', 'Alert when stock falls below reorder point', TRUE,
      '{"safety_factor": 1.3, "target_cover_days": 30, "sales_window_days": 30}'),
    (p_org_id, 'dead_stock', 'Dead Stock', 'Flag slow-moving or unsold inventory', TRUE,
      '{"yellow_days": 60, "orange_days": 90, "red_days": 180}'),
    (p_org_id, 'abc_classification', 'ABC Classification', 'Classify products by revenue contribution', TRUE,
      '{"a_threshold": 0.8, "b_threshold": 0.95}'),
    (p_org_id, 'real_margin', 'Real Margin', 'Alert products with margin below threshold', TRUE,
      '{"red_threshold": 0.15, "yellow_threshold": 0.25}'),
    (p_org_id, 'customer_churn', 'Customer Churn', 'Flag customers who may be churning', TRUE,
      '{"churn_factor": 1.5, "min_orders": 3}'),
    (p_org_id, 'supplier_scorecard', 'Supplier Scorecard', 'Flag underperforming suppliers', TRUE,
      '{"lead_time_variance_threshold": 1.3, "fill_rate_threshold": 0.9, "defect_rate_threshold": 0.03}'),
    (p_org_id, 'ecommerce_pipeline', 'E-commerce Pipeline', 'Surface SKUs ready to list online', TRUE,
      '{"min_margin": 0.25, "min_days_cover": 30, "limit": 5}'),
    (p_org_id, 'seasonal_preorder', 'Seasonal Pre-order', 'Plan ahead for seasonal demand', TRUE,
      '{"warning_days": 90, "critical_days": 60, "growth_factor": 1.1}')
  ON CONFLICT (organization_id, rule_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

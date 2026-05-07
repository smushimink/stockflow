-- Add profit-focused columns to product_metrics
ALTER TABLE product_metrics
  ADD COLUMN IF NOT EXISTS gross_profit_90d        NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_margin_pct         NUMERIC(8,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_turnover       NUMERIC(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_inventory_value      NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cogs_90d                 NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribution_margin_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0;

-- ============================================================
-- Updated calculate_product_metrics — adds profit columns
-- Computed in the same single UPDATE FROM SELECT pass.
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
    cash_tied_up,
    gross_profit_90d, gross_margin_pct,
    inventory_turnover, avg_inventory_value,
    cogs_90d, contribution_margin_per_unit
  )
  WITH
  velocity AS (
    SELECT
      soi.product_id,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '7 days'  THEN soi.qty ELSE 0 END) / 7.0  AS avg_7d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '30 days' THEN soi.qty ELSE 0 END) / 30.0 AS avg_30d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.qty ELSE 0 END) / 90.0 AS avg_90d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.total        ELSE 0 END) AS revenue_90d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days' THEN soi.qty          ELSE 0 END)::INTEGER AS units_90d,
      -- Profit columns
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days'
          THEN soi.qty * soi.unit_cost ELSE 0 END) AS cogs_90d,
      SUM(CASE WHEN so.ordered_at >= NOW() - INTERVAL '90 days'
          THEN soi.qty * soi.unit_price - soi.qty * soi.unit_cost - soi.discount
          ELSE 0 END) AS gross_profit_90d
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
      CASE WHEN SUM(soi.qty) > 0 THEN SUM(soi.discount) / SUM(soi.qty) ELSE 0 END AS avg_discount
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
    p.id                                                                    AS product_id,
    NOW()                                                                   AS calculated_at,

    COALESCE(v.avg_7d, 0)                                                   AS avg_daily_sales_7d,
    COALESCE(v.avg_30d, 0)                                                  AS avg_daily_sales_30d,
    COALESCE(v.avg_90d, 0)                                                  AS avg_daily_sales_90d,

    CASE
      WHEN COALESCE(v.avg_30d, 0) > 0 THEN LEAST(9999, p.stock_on_hand / v.avg_30d)
      ELSE 9999
    END                                                                     AS days_of_cover,

    CASE
      WHEN ls.last_sale_at IS NOT NULL
        THEN (EXTRACT(epoch FROM (NOW() - ls.last_sale_at)) / 86400.0)::INTEGER
      ELSE NULL
    END                                                                     AS days_since_last_sale,

    ls.last_sale_at,

    COALESCE(v.revenue_90d, 0)                                              AS revenue_90d,
    COALESCE(v.units_90d, 0)                                                AS units_sold_90d,

    p.unit_cost                                                             AS real_unit_cost,
    COALESCE(d.avg_discount, 0)                                             AS avg_discount,
    0                                                                       AS avg_platform_fee,

    CASE
      WHEN p.selling_price > 0
        THEN (p.selling_price - p.unit_cost - COALESCE(d.avg_discount, 0)) / p.selling_price
      ELSE 0
    END                                                                     AS real_margin_pct,

    p.stock_on_hand * p.unit_cost                                           AS cash_tied_up,

    -- Profit columns
    COALESCE(v.gross_profit_90d, 0)                                         AS gross_profit_90d,

    CASE
      WHEN COALESCE(v.revenue_90d, 0) > 0
        THEN COALESCE(v.gross_profit_90d, 0) / v.revenue_90d
      ELSE 0
    END                                                                     AS gross_margin_pct,

    CASE
      WHEN p.stock_on_hand > 0 AND p.unit_cost > 0
        THEN (COALESCE(v.cogs_90d, 0) / 90.0) * 365.0 / (p.stock_on_hand * p.unit_cost)
      ELSE 0
    END                                                                     AS inventory_turnover,

    p.stock_on_hand * p.unit_cost                                           AS avg_inventory_value,

    COALESCE(v.cogs_90d, 0)                                                 AS cogs_90d,

    p.selling_price - p.unit_cost - COALESCE(d.avg_discount, 0)            AS contribution_margin_per_unit

  FROM products p
  LEFT JOIN velocity  v  ON v.product_id  = p.id
  LEFT JOIN last_sale ls ON ls.product_id = p.id
  LEFT JOIN discounts d  ON d.product_id  = p.id
  WHERE p.organization_id = p_org_id

  ON CONFLICT (organization_id, product_id) DO UPDATE SET
    calculated_at               = EXCLUDED.calculated_at,
    avg_daily_sales_7d          = EXCLUDED.avg_daily_sales_7d,
    avg_daily_sales_30d         = EXCLUDED.avg_daily_sales_30d,
    avg_daily_sales_90d         = EXCLUDED.avg_daily_sales_90d,
    days_of_cover               = EXCLUDED.days_of_cover,
    days_since_last_sale        = EXCLUDED.days_since_last_sale,
    last_sale_at                = EXCLUDED.last_sale_at,
    revenue_90d                 = EXCLUDED.revenue_90d,
    units_sold_90d              = EXCLUDED.units_sold_90d,
    real_unit_cost              = EXCLUDED.real_unit_cost,
    avg_discount                = EXCLUDED.avg_discount,
    avg_platform_fee            = EXCLUDED.avg_platform_fee,
    real_margin_pct             = EXCLUDED.real_margin_pct,
    cash_tied_up                = EXCLUDED.cash_tied_up,
    gross_profit_90d            = EXCLUDED.gross_profit_90d,
    gross_margin_pct            = EXCLUDED.gross_margin_pct,
    inventory_turnover          = EXCLUDED.inventory_turnover,
    avg_inventory_value         = EXCLUDED.avg_inventory_value,
    cogs_90d                    = EXCLUDED.cogs_90d,
    contribution_margin_per_unit = EXCLUDED.contribution_margin_per_unit;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

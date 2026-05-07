-- Add profit columns to suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS total_purchases_90d    NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_supplied      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_margin_on_supplied NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS last_price_change_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_volatility       NUMERIC(8,4);

-- ============================================================
-- recalculate_supplier_metrics
-- Computes supplier-level rollups from product_metrics + POs.
-- Must run after calculate_product_metrics so gross_margin_pct is fresh.
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_supplier_metrics(p_org_id UUID)
RETURNS void AS $$
BEGIN
  WITH purchase_totals AS (
    SELECT
      supplier_id,
      SUM(total) AS total_purchases_90d
    FROM purchase_orders
    WHERE organization_id = p_org_id
      AND status = 'received'
      AND received_at >= NOW() - INTERVAL '90 days'
      AND supplier_id IS NOT NULL
    GROUP BY supplier_id
  ),
  product_counts AS (
    SELECT
      supplier_id,
      COUNT(*)::INTEGER AS products_supplied
    FROM products
    WHERE organization_id = p_org_id
      AND supplier_id IS NOT NULL
      AND status != 'discontinued'
    GROUP BY supplier_id
  ),
  margin_agg AS (
    -- Weighted average gross margin, weighted by revenue_90d
    SELECT
      p.supplier_id,
      CASE
        WHEN SUM(pm.revenue_90d) > 0
          THEN SUM(pm.gross_margin_pct * pm.revenue_90d) / SUM(pm.revenue_90d)
        ELSE NULL
      END AS avg_margin_on_supplied
    FROM products p
    JOIN product_metrics pm ON pm.product_id = p.id AND pm.organization_id = p_org_id
    WHERE p.organization_id = p_org_id
      AND p.supplier_id IS NOT NULL
    GROUP BY p.supplier_id
  )
  UPDATE suppliers s
  SET
    total_purchases_90d    = COALESCE(pt.total_purchases_90d, 0),
    products_supplied      = COALESCE(pc.products_supplied, 0),
    avg_margin_on_supplied = ma.avg_margin_on_supplied,
    updated_at             = NOW()
  FROM product_counts pc
  LEFT JOIN purchase_totals pt ON pt.supplier_id = pc.supplier_id
  LEFT JOIN margin_agg      ma ON ma.supplier_id  = pc.supplier_id
  WHERE pc.supplier_id = s.id
    AND s.organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

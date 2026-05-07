-- product_forecasts: stores probabilistic forecast results per SKU per org
CREATE TABLE product_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Fitted distribution
  lambda NUMERIC,         -- mean daily demand (EWMA-corrected)
  k NUMERIC,              -- NB dispersion (higher = less variable)
  fit_quality NUMERIC,    -- 0-1 composite quality score
  demand_pattern TEXT CHECK (demand_pattern IN ('smooth','erratic','lumpy','intermittent','sparse')),

  -- Lead-time demand distribution
  lead_time_days_used INTEGER,
  ltd_mean NUMERIC,
  ltd_stddev NUMERIC,
  ltd_p50 NUMERIC,
  ltd_p95 NUMERIC,

  -- Recommendations
  recommended_rop NUMERIC,
  recommended_target_stock NUMERIC,
  recommended_order_qty NUMERIC,
  service_level_used NUMERIC,
  critical_ratio NUMERIC,

  -- Quality metadata
  censored_days INTEGER DEFAULT 0,
  data_points INTEGER,
  warning TEXT,   -- 'sparse_data' | 'high_variability' | 'requires_review' | 'sibling_proxy'

  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, product_id)
);

CREATE INDEX idx_forecasts_org ON product_forecasts(organization_id);
CREATE INDEX idx_forecasts_product ON product_forecasts(product_id);

-- Grant access
ALTER TABLE product_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read forecasts"
  ON product_forecasts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid()
    )
  );

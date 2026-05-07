-- Detected seasonality patterns per product.
-- peak_periods stores all 12 monthly indices (not just peaks) so the heatmap
-- can read a single column for the full yearly shape.
-- trough_periods is a convenience subset for quick rule evaluation.

CREATE TABLE seasonality_patterns (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id         UUID        REFERENCES products(id) ON DELETE CASCADE,  -- NULL = org-level fallback
  category           TEXT,
  pattern_type       TEXT        NOT NULL CHECK (pattern_type IN ('weekly', 'monthly', 'quarterly', 'annual', 'event')),
  peak_periods       JSONB       NOT NULL,  -- [{month, multiplier}] × 12 — full annual shape
  trough_periods     JSONB,                 -- [{month, multiplier}] for months < 0.6 only
  confidence         NUMERIC     NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  manually_confirmed BOOLEAN     NOT NULL DEFAULT false,
  notes              TEXT
);

CREATE INDEX idx_seasonality_org      ON seasonality_patterns(organization_id);
CREATE INDEX idx_seasonality_product  ON seasonality_patterns(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_seasonality_type     ON seasonality_patterns(organization_id, pattern_type);

-- RLS: same org-membership gate used throughout the project
ALTER TABLE seasonality_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read seasonality patterns"
  ON seasonality_patterns FOR SELECT
  USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "org members can write seasonality patterns"
  ON seasonality_patterns FOR ALL
  USING (organization_id = ANY(get_user_org_ids()));

-- Weekly Sunday 3am AEST (17:00 UTC Saturday) detection job.
-- Calls the /api/cron/detect-seasonality Vercel route.
-- Requires pg_net extension; comment out if not available.
-- SELECT cron.schedule(
--   'weekly-seasonality-detection',
--   '0 17 * * 0',
--   $$ SELECT net.http_post(
--     url := current_setting('app.base_url') || '/api/cron/detect-seasonality',
--     headers := '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
--   ) $$
-- );

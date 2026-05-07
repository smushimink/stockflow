-- External market context signals: FX rates, category trends, manual notes, etc.
-- value JSONB shapes:
--   fx_rate:        { from_currency, to_currency, rate, prior_rate }
--   category_trend: { category, trend: "rising"|"stable"|"declining" }
--   manual_note:    { tags: string[], text: string }
--   commodity_price/inflation/competitor_price: free-form JSONB

CREATE TABLE market_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type     TEXT        NOT NULL CHECK (signal_type IN (
                                'fx_rate', 'commodity_price', 'inflation',
                                'category_trend', 'competitor_price', 'manual_note'
                              )),
  source          TEXT        NOT NULL DEFAULT 'manual',
  value           JSONB       NOT NULL DEFAULT '{}',
  effective_from  DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_signals_org      ON market_signals(organization_id);
CREATE INDEX idx_market_signals_org_type ON market_signals(organization_id, signal_type);
CREATE INDEX idx_market_signals_active   ON market_signals(organization_id, effective_from)
  WHERE effective_until IS NULL;

ALTER TABLE market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_signals_all" ON market_signals FOR ALL
  USING  (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

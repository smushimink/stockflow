-- Add business_context JSONB column to organizations
-- Provides business-type awareness that shapes decision rule thresholds.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_context JSONB NOT NULL DEFAULT '{
    "business_type": "wholesale",
    "industry": "other",
    "products_perishable": false,
    "avg_shelf_life_days": null,
    "warehouse_size_sqm": null,
    "warehouse_cost_monthly": null,
    "payment_terms_default_days": 30,
    "primary_currency": "AUD",
    "primary_country": "AU",
    "active_seasons": [],
    "business_age_months": 12,
    "primary_sales_channels": ["b2b_direct"],
    "customer_concentration_risk_threshold": 30,
    "notes": ""
  }'::jsonb;

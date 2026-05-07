-- Per-product rule overrides: a product can override org-level rule thresholds.
-- Format: { reorder: { safety_factor: 1.5 }, dead_stock: { red_days: 30 } }
-- Engine merges: product overrides win over org config.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rule_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.rule_overrides IS
  'Per-product rule config overrides. Keys are rule_type, values mirror decision_rules.config shape.';

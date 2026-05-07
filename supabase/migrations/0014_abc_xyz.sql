-- ABC-XYZ classification columns
-- xyz_class: demand variability (X=stable, Y=moderate, Z=erratic)
-- abc_xyz_class: combined 9-class label (AX..CZ)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS xyz_class TEXT CHECK (xyz_class IN ('X', 'Y', 'Z')),
  ADD COLUMN IF NOT EXISTS abc_xyz_class TEXT;

ALTER TABLE product_metrics
  ADD COLUMN IF NOT EXISTS xyz_class TEXT CHECK (xyz_class IN ('X', 'Y', 'Z')),
  ADD COLUMN IF NOT EXISTS abc_xyz_class TEXT;

CREATE INDEX IF NOT EXISTS idx_products_abc_xyz ON products(organization_id, abc_xyz_class);
CREATE INDEX IF NOT EXISTS idx_metrics_abc_xyz ON product_metrics(organization_id, abc_xyz_class);

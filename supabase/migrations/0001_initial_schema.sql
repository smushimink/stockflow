-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================================
-- ORGANIZATIONS & USERS
-- ============================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business')),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'buyer', 'sales', 'warehouse', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 14,
  moq INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'AUD',
  payment_terms TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_org ON suppliers(organization_id);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,4) NOT NULL DEFAULT 0,
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  reorder_qty INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER,
  moq INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'draft')),
  listed_online BOOLEAN NOT NULL DEFAULT FALSE,
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  season_tags TEXT[] DEFAULT '{}',
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  external_id TEXT,
  barcode TEXT,
  weight_kg NUMERIC(8,3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, sku)
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_org_status ON products(organization_id, status);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_external ON products(organization_id, external_id);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  external_id TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,4) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  avg_order_interval_days NUMERIC(8,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_org ON customers(organization_id);

-- ============================================================
-- SALES ORDERS
-- ============================================================

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'pending', 'completed', 'cancelled', 'refunded')),
  subtotal NUMERIC(12,4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,4) NOT NULL DEFAULT 0,
  shipping_total NUMERIC(12,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12,4) NOT NULL DEFAULT 0,
  total NUMERIC(12,4) NOT NULL DEFAULT 0,
  platform TEXT,
  external_id TEXT,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_orders_org ON sales_orders(organization_id);
CREATE INDEX idx_sales_orders_org_date ON sales_orders(organization_id, ordered_at DESC);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);

CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  discount NUMERIC(12,4) NOT NULL DEFAULT 0,
  total NUMERIC(12,4) NOT NULL
);

CREATE INDEX idx_soi_order ON sales_order_items(order_id);
CREATE INDEX idx_soi_product ON sales_order_items(product_id);
CREATE INDEX idx_soi_org ON sales_order_items(organization_id);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  subtotal NUMERIC(12,4) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,4) NOT NULL DEFAULT 0,
  total NUMERIC(12,4) NOT NULL DEFAULT 0,
  expected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_org ON purchase_orders(organization_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,4) NOT NULL,
  total NUMERIC(12,4) NOT NULL
);

CREATE INDEX idx_poi_order ON purchase_order_items(order_id);
CREATE INDEX idx_poi_product ON purchase_order_items(product_id);

-- ============================================================
-- INVENTORY SNAPSHOTS
-- ============================================================

CREATE TABLE inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  stock_on_hand INTEGER NOT NULL,
  stock_committed INTEGER NOT NULL DEFAULT 0,
  stock_available INTEGER GENERATED ALWAYS AS (stock_on_hand - stock_committed) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, product_id, snapshot_date)
);

CREATE INDEX idx_snapshots_org_date ON inventory_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_product ON inventory_snapshots(product_id, snapshot_date DESC);

-- ============================================================
-- PRODUCT METRICS (computed daily)
-- ============================================================

CREATE TABLE product_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  avg_daily_sales_7d NUMERIC(10,4) NOT NULL DEFAULT 0,
  avg_daily_sales_30d NUMERIC(10,4) NOT NULL DEFAULT 0,
  avg_daily_sales_90d NUMERIC(10,4) NOT NULL DEFAULT 0,
  days_of_cover NUMERIC(10,2) NOT NULL DEFAULT 0,
  days_since_last_sale INTEGER,
  last_sale_at TIMESTAMPTZ,
  revenue_90d NUMERIC(12,4) NOT NULL DEFAULT 0,
  units_sold_90d INTEGER NOT NULL DEFAULT 0,
  real_unit_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
  real_margin_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
  avg_platform_fee NUMERIC(12,4) NOT NULL DEFAULT 0,
  avg_discount NUMERIC(12,4) NOT NULL DEFAULT 0,
  abc_class TEXT CHECK (abc_class IN ('A', 'B', 'C')),
  cash_tied_up NUMERIC(12,4) NOT NULL DEFAULT 0,
  UNIQUE (organization_id, product_id)
);

CREATE INDEX idx_metrics_org ON product_metrics(organization_id);
CREATE INDEX idx_metrics_product ON product_metrics(product_id);

-- ============================================================
-- DECISION RULES
-- ============================================================

CREATE TABLE decision_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, rule_type)
);

CREATE INDEX idx_rules_org ON decision_rules(organization_id);

-- ============================================================
-- DECISION ALERTS
-- ============================================================

CREATE TABLE decision_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  related_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  related_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  related_supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'yellow' CHECK (severity IN ('red', 'orange', 'yellow', 'green')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed', 'dismissed')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT,
  suggested_action TEXT,
  suggested_value NUMERIC(12,4),
  suggested_qty INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  snooze_until TIMESTAMPTZ,
  dismissal_reason TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_org_status ON decision_alerts(organization_id, status, created_at DESC);
CREATE INDEX idx_alerts_product ON decision_alerts(related_product_id);
CREATE INDEX idx_alerts_rule ON decision_alerts(organization_id, rule_type);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('shopify', 'xero', 'myob', 'amazon', 'ebay', 'square', 'lightspeed', 'csv', 'zapier')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
  credentials_encrypted TEXT,
  shop_domain TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  sync_config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX idx_integrations_org ON integrations(organization_id);

CREATE TABLE integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DATA PROVENANCE (audit trail)
-- ============================================================

CREATE TABLE data_provenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'shopify', 'xero', 'csv', 'rule', 'cron', 'api')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_provenance_record ON data_provenance(table_name, record_id, changed_at DESC);
CREATE INDEX idx_provenance_org ON data_provenance(organization_id, changed_at DESC);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sales_orders_updated BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON decision_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_alerts_updated BEFORE UPDATE ON decision_alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

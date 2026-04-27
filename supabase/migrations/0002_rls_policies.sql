-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_provenance ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org ids
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(SELECT organization_id FROM memberships WHERE user_id = auth.uid())
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ORGANIZATIONS: members can select, owners can update
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id = ANY(get_user_org_ids()));

CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND role = 'owner'));

-- MEMBERSHIPS: see own memberships
CREATE POLICY "membership_select" ON memberships FOR SELECT
  USING (user_id = auth.uid() OR organization_id = ANY(get_user_org_ids()));

CREATE POLICY "membership_insert" ON memberships FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

CREATE POLICY "membership_delete" ON memberships FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND role = 'owner'));

-- Macro for org-scoped tables
-- SUPPLIERS
CREATE POLICY "suppliers_all" ON suppliers FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- PRODUCTS
CREATE POLICY "products_all" ON products FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- CUSTOMERS
CREATE POLICY "customers_all" ON customers FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- SALES ORDERS
CREATE POLICY "sales_orders_all" ON sales_orders FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- SALES ORDER ITEMS
CREATE POLICY "soi_all" ON sales_order_items FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- PURCHASE ORDERS
CREATE POLICY "po_all" ON purchase_orders FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- PURCHASE ORDER ITEMS
CREATE POLICY "poi_all" ON purchase_order_items FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- INVENTORY SNAPSHOTS
CREATE POLICY "snapshots_all" ON inventory_snapshots FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- PRODUCT METRICS
CREATE POLICY "metrics_all" ON product_metrics FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- DECISION RULES
CREATE POLICY "rules_all" ON decision_rules FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- DECISION ALERTS
CREATE POLICY "alerts_all" ON decision_alerts FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- INTEGRATIONS
CREATE POLICY "integrations_all" ON integrations FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- INTEGRATION FIELD MAPPINGS
CREATE POLICY "ifm_all" ON integration_field_mappings FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

-- DATA PROVENANCE
CREATE POLICY "provenance_all" ON data_provenance FOR ALL
  USING (organization_id = ANY(get_user_org_ids()))
  WITH CHECK (organization_id = ANY(get_user_org_ids()));

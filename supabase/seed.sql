-- StockFlow seed data
-- Run after migrations. Creates 1 org, 5 suppliers, 50 products, 200+ sales orders.

DO $$
DECLARE
  v_org_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_user_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  -- Supplier IDs
  v_sup_1 UUID := gen_random_uuid();
  v_sup_2 UUID := gen_random_uuid();
  v_sup_3 UUID := gen_random_uuid();
  v_sup_4 UUID := gen_random_uuid();
  v_sup_5 UUID := gen_random_uuid();

  v_prod RECORD;
  v_order_id UUID;
  v_day_offset INTEGER;
  i INTEGER;
BEGIN

-- ============================================================
-- ORGANIZATION
-- ============================================================
INSERT INTO organizations (id, name, slug, plan) VALUES
  (v_org_id, 'Sydney Wholesale Demo', 'sydney-wholesale-demo', 'pro')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUPPLIERS
-- ============================================================
INSERT INTO suppliers (id, organization_id, name, code, contact_name, contact_email, lead_time_days, moq, currency) VALUES
  (v_sup_1, v_org_id, 'AusPack Suppliers', 'APS', 'Michael Chen', 'michael@auspack.com.au', 14, 10, 'AUD'),
  (v_sup_2, v_org_id, 'Pacific Trade Co', 'PTC', 'Sarah Nguyen', 'sarah@pacifictrade.com', 21, 50, 'AUD'),
  (v_sup_3, v_org_id, 'Global Import Hub', 'GIH', 'James Wilson', 'james@globalimport.com', 35, 100, 'USD'),
  (v_sup_4, v_org_id, 'Local Craft Goods', 'LCG', 'Emma Davis', 'emma@localcraft.com.au', 7, 5, 'AUD'),
  (v_sup_5, v_org_id, 'Eastside Distributors', 'ESD', 'Tom Lee', 'tom@eastside.com.au', 10, 20, 'AUD');

-- ============================================================
-- PRODUCTS (50 SKUs across categories)
-- ============================================================
INSERT INTO products (organization_id, supplier_id, sku, name, category, unit_cost, selling_price, stock_on_hand, reorder_point, reorder_qty, lead_time_days, status) VALUES
  -- Kitchenware (active, healthy)
  (v_org_id, v_sup_1, 'KW-001', 'Bamboo Cutting Board Large', 'Kitchenware', 12.50, 34.95, 45, 20, 50, 14, 'active'),
  (v_org_id, v_sup_1, 'KW-002', 'Silicone Spatula Set (3pc)', 'Kitchenware', 8.00, 22.95, 80, 30, 60, 14, 'active'),
  (v_org_id, v_sup_1, 'KW-003', 'Ceramic Mixing Bowl Set', 'Kitchenware', 22.00, 59.95, 30, 15, 30, 14, 'active'),
  (v_org_id, v_sup_1, 'KW-004', 'Stainless Steel Colander', 'Kitchenware', 14.00, 39.95, 25, 12, 25, 14, 'active'),
  (v_org_id, v_sup_1, 'KW-005', 'Wooden Spoon Set (5pc)', 'Kitchenware', 6.00, 18.95, 60, 25, 50, 14, 'active'),

  -- Homewares (some dead stock)
  (v_org_id, v_sup_2, 'HW-001', 'Linen Table Runner Beige', 'Homewares', 18.00, 49.95, 35, 10, 30, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-002', 'Scented Soy Candle 300g', 'Homewares', 9.00, 28.95, 55, 20, 40, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-003', 'Macrame Wall Hanging', 'Homewares', 25.00, 75.00, 8, 5, 15, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-004', 'Rattan Storage Basket Lg', 'Homewares', 20.00, 55.00, 12, 6, 20, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-005', 'Terracotta Plant Pot Set', 'Homewares', 15.00, 44.95, 20, 8, 20, 21, 'active'),
  -- Dead stock items
  (v_org_id, v_sup_2, 'HW-006', 'Vintage Map Print Frame', 'Homewares', 32.00, 89.95, 22, 5, 10, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-007', 'Crystal Vase Collection', 'Homewares', 45.00, 120.00, 15, 3, 10, 21, 'active'),
  (v_org_id, v_sup_2, 'HW-008', 'Copper Table Lamp Base', 'Homewares', 55.00, 149.95, 8, 2, 5, 21, 'active'),

  -- Personal Care (low margin)
  (v_org_id, v_sup_3, 'PC-001', 'Argan Oil Shampoo 500ml', 'Personal Care', 9.50, 19.95, 100, 40, 80, 35, 'active'),
  (v_org_id, v_sup_3, 'PC-002', 'Vitamin C Serum 30ml', 'Personal Care', 12.00, 24.95, 75, 30, 60, 35, 'active'),
  (v_org_id, v_sup_3, 'PC-003', 'Natural Deodorant Stick', 'Personal Care', 6.00, 11.95, 120, 50, 100, 35, 'active'),
  (v_org_id, v_sup_3, 'PC-004', 'Micellar Cleansing Water', 'Personal Care', 7.50, 14.95, 90, 35, 70, 35, 'active'),
  (v_org_id, v_sup_3, 'PC-005', 'Coconut Body Scrub 300g', 'Personal Care', 8.00, 16.95, 65, 25, 50, 35, 'active'),

  -- Stationery (Class A sellers)
  (v_org_id, v_sup_4, 'ST-001', 'Leather Notebook A5', 'Stationery', 15.00, 42.95, 55, 20, 40, 7, 'active'),
  (v_org_id, v_sup_4, 'ST-002', 'Brass Desk Pen Holder', 'Stationery', 22.00, 59.95, 40, 15, 30, 7, 'active'),
  (v_org_id, v_sup_4, 'ST-003', 'Washi Tape Set (12pc)', 'Stationery', 8.50, 24.95, 70, 25, 50, 7, 'active'),
  (v_org_id, v_sup_4, 'ST-004', 'Calligraphy Set Beginner', 'Stationery', 18.00, 49.95, 35, 15, 30, 7, 'active'),
  (v_org_id, v_sup_4, 'ST-005', 'Cork Board 60x40cm', 'Stationery', 12.00, 34.95, 28, 12, 25, 7, 'active'),

  -- Outdoor & Garden
  (v_org_id, v_sup_5, 'OG-001', 'Stainless BBQ Tongs 40cm', 'Outdoor', 11.00, 29.95, 42, 15, 30, 10, 'active'),
  (v_org_id, v_sup_5, 'OG-002', 'Garden Kneeler Pad', 'Outdoor', 9.00, 24.95, 35, 15, 30, 10, 'active'),
  (v_org_id, v_sup_5, 'OG-003', 'Solar Path Lights (4pk)', 'Outdoor', 28.00, 74.95, 25, 10, 20, 10, 'active'),
  (v_org_id, v_sup_5, 'OG-004', 'Bamboo Wind Chimes', 'Outdoor', 16.00, 44.95, 18, 8, 15, 10, 'active'),
  (v_org_id, v_sup_5, 'OG-005', 'Hanging Planter Macrame', 'Outdoor', 12.00, 34.95, 30, 12, 25, 10, 'active'),

  -- Sports & Fitness
  (v_org_id, v_sup_3, 'SF-001', 'Resistance Band Set (5pc)', 'Sports', 14.00, 39.95, 48, 20, 40, 35, 'active'),
  (v_org_id, v_sup_3, 'SF-002', 'Yoga Mat 6mm Non-Slip', 'Sports', 22.00, 59.95, 30, 12, 25, 35, 'active'),
  (v_org_id, v_sup_3, 'SF-003', 'Jump Rope Steel Cable', 'Sports', 8.00, 22.95, 55, 20, 40, 35, 'active'),
  (v_org_id, v_sup_3, 'SF-004', 'Foam Roller 90cm', 'Sports', 18.00, 49.95, 22, 10, 20, 35, 'active'),
  (v_org_id, v_sup_3, 'SF-005', 'Water Bottle 750ml Insul', 'Sports', 12.00, 34.95, 65, 25, 50, 35, 'active'),

  -- Kids & Toys
  (v_org_id, v_sup_2, 'KD-001', 'Wooden Block Set 30pc', 'Kids', 28.00, 74.95, 20, 8, 15, 21, 'active'),
  (v_org_id, v_sup_2, 'KD-002', 'Play Dough Set 6 Colors', 'Kids', 10.00, 28.95, 45, 18, 35, 21, 'active'),
  (v_org_id, v_sup_2, 'KD-003', 'Watercolor Paint Set Kids', 'Kids', 8.50, 24.95, 38, 15, 30, 21, 'active'),

  -- Tech Accessories (need reorder)
  (v_org_id, v_sup_1, 'TA-001', 'USB-C Hub 7-in-1', 'Tech', 35.00, 89.95, 8, 15, 30, 14, 'active'),  -- below reorder
  (v_org_id, v_sup_1, 'TA-002', 'Laptop Stand Aluminium', 'Tech', 28.00, 79.95, 5, 12, 25, 14, 'active'),  -- below reorder
  (v_org_id, v_sup_1, 'TA-003', 'Wireless Charger Pad 15W', 'Tech', 18.00, 49.95, 12, 20, 40, 14, 'active'),  -- below reorder
  (v_org_id, v_sup_1, 'TA-004', 'Cable Management Box', 'Tech', 15.00, 39.95, 25, 10, 20, 14, 'active'),
  (v_org_id, v_sup_1, 'TA-005', 'Screen Cleaning Kit', 'Tech', 6.00, 18.95, 80, 30, 60, 14, 'active'),

  -- Seasonal items
  (v_org_id, v_sup_2, 'SN-001', 'Christmas Tree Skirt Felt', 'Seasonal', 18.00, 49.95, 35, 10, 30, 21, 'active'),
  (v_org_id, v_sup_2, 'SN-002', 'Easter Basket Woven Set', 'Seasonal', 12.00, 34.95, 40, 10, 30, 21, 'active'),
  (v_org_id, v_sup_2, 'SN-003', 'Halloween Decoration Kit', 'Seasonal', 20.00, 55.00, 28, 8, 20, 21, 'active'),

  -- More varied items
  (v_org_id, v_sup_4, 'MX-001', 'Beeswax Food Wrap Set', 'Kitchen', 11.00, 32.95, 55, 20, 40, 7, 'active'),
  (v_org_id, v_sup_4, 'MX-002', 'Reusable Coffee Cup 350ml', 'Kitchen', 16.00, 44.95, 42, 15, 30, 7, 'active'),
  (v_org_id, v_sup_5, 'MX-003', 'Door Draft Stopper Snake', 'Home', 8.00, 22.95, 35, 15, 30, 10, 'active'),
  (v_org_id, v_sup_5, 'MX-004', 'Cable Organiser Velcro Pack', 'Tech', 4.00, 12.95, 120, 40, 80, 10, 'active'),
  (v_org_id, v_sup_1, 'MX-005', 'Silicone Baking Mat Set', 'Kitchen', 10.00, 28.95, 48, 18, 35, 14, 'active'),
  (v_org_id, v_sup_3, 'MX-006', 'Hand Sanitiser 500ml', 'Personal Care', 5.00, 9.95, 200, 80, 150, 35, 'active'),
  (v_org_id, v_sup_4, 'MX-007', 'Sticky Note Cube 400sheets', 'Stationery', 5.00, 14.95, 90, 35, 70, 7, 'active');

-- ============================================================
-- CUSTOMERS (15 customers)
-- ============================================================
INSERT INTO customers (organization_id, name, email, company, total_orders, last_order_at) VALUES
  (v_org_id, 'David Thompson', 'david.t@gmail.com', NULL, 12, NOW() - INTERVAL '5 days'),
  (v_org_id, 'Olivia Chen', 'olivia.chen@outlook.com', NULL, 8, NOW() - INTERVAL '2 days'),
  (v_org_id, 'James Morrison', 'jmorrison@company.com.au', 'Morrison & Co', 25, NOW() - INTERVAL '1 day'),
  (v_org_id, 'Sophie Williams', 'sophie.w@gmail.com', NULL, 6, NOW() - INTERVAL '12 days'),
  (v_org_id, 'Liam Anderson', 'liam.a@hotmail.com', NULL, 4, NOW() - INTERVAL '3 days'),
  (v_org_id, 'Chloe Martinez', 'chloe.m@gmail.com', NULL, 9, NOW() - INTERVAL '85 days'),  -- churning
  (v_org_id, 'Noah Johnson', 'noah.j@yahoo.com', NULL, 7, NOW() - INTERVAL '95 days'),  -- churning
  (v_org_id, 'Emma Wilson', 'emma.w@gmail.com', 'Wilson Retail', 18, NOW() - INTERVAL '8 days'),
  (v_org_id, 'Ava Brown', 'ava.b@gmail.com', NULL, 3, NOW() - INTERVAL '14 days'),
  (v_org_id, 'Lucas Taylor', 'lucas.t@company.com', 'Taylor Group', 31, NOW() - INTERVAL '3 days'),
  (v_org_id, 'Mia Davis', 'mia.d@gmail.com', NULL, 5, NOW() - INTERVAL '20 days'),
  (v_org_id, 'Ethan Garcia', 'ethan.g@outlook.com', NULL, 11, NOW() - INTERVAL '6 days'),
  (v_org_id, 'Isabella Harris', 'isabella.h@gmail.com', NULL, 4, NOW() - INTERVAL '100 days'),  -- churning
  (v_org_id, 'Mason Clark', 'mason.c@company.com.au', 'Clark & Sons', 22, NOW() - INTERVAL '1 day'),
  (v_org_id, 'Amelia Lewis', 'amelia.l@gmail.com', NULL, 6, NOW() - INTERVAL '45 days');

-- ============================================================
-- SALES ORDERS (200+ orders over 90 days, skewed to popular SKUs)
-- ============================================================
-- We'll generate orders using a loop
FOR v_day_offset IN 0..89 LOOP
  -- 2-3 orders per day
  FOR i IN 1..2 + (CASE WHEN v_day_offset % 7 IN (5,6) THEN 1 ELSE 0 END) LOOP
    v_order_id := gen_random_uuid();

    INSERT INTO sales_orders (id, organization_id, customer_id, order_number, status, subtotal, total, ordered_at)
    SELECT
      v_order_id,
      v_org_id,
      c.id,
      'ORD-' || LPAD((90000 - v_day_offset * 3 + i)::TEXT, 5, '0'),
      'completed',
      0,
      0,
      NOW() - (v_day_offset || ' days')::INTERVAL + (RANDOM() * INTERVAL '20 hours')
    FROM customers c
    WHERE c.organization_id = v_org_id
    ORDER BY RANDOM()
    LIMIT 1;

    -- Add 1-3 items to each order, favour popular SKUs
    INSERT INTO sales_order_items (organization_id, order_id, product_id, sku, name, qty, unit_price, unit_cost, total)
    SELECT
      v_org_id,
      v_order_id,
      p.id,
      p.sku,
      p.name,
      (1 + FLOOR(RANDOM() * 3))::INTEGER,
      p.selling_price,
      p.unit_cost,
      p.selling_price * (1 + FLOOR(RANDOM() * 3))
    FROM products p
    WHERE p.organization_id = v_org_id
      AND p.status = 'active'
      AND p.sku NOT IN ('HW-006','HW-007','HW-008')  -- dead stock items get no sales
    ORDER BY RANDOM()
    LIMIT (1 + FLOOR(RANDOM() * 2))::INTEGER;

    -- Update order totals
    UPDATE sales_orders so
    SET
      subtotal = (SELECT COALESCE(SUM(total), 0) FROM sales_order_items WHERE order_id = v_order_id),
      total = (SELECT COALESCE(SUM(total), 0) FROM sales_order_items WHERE order_id = v_order_id)
    WHERE id = v_order_id;
  END LOOP;
END LOOP;

-- ============================================================
-- INVENTORY SNAPSHOTS (last 30 days)
-- ============================================================
FOR v_day_offset IN 0..29 LOOP
  INSERT INTO inventory_snapshots (organization_id, product_id, snapshot_date, stock_on_hand)
  SELECT
    p.organization_id,
    p.id,
    CURRENT_DATE - v_day_offset,
    GREATEST(0, p.stock_on_hand - FLOOR(RANDOM() * 3)::INTEGER)
  FROM products p
  WHERE p.organization_id = v_org_id
  ON CONFLICT (organization_id, product_id, snapshot_date) DO NOTHING;
END LOOP;

-- ============================================================
-- SEED DEFAULT DECISION RULES
-- ============================================================
PERFORM seed_default_rules(v_org_id);

RAISE NOTICE 'Seed data created for org %', v_org_id;
END $$;

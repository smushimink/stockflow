# PHASE_2 ADDENDUM — Wholesale profit lens

> This addendum re-anchors Phase 2 around the 5 real money questions of a wholesale/warehouse business:
>
> 1. What should I stock?
> 2. Which suppliers are worth it?
> 3. Which customers are profitable?
> 4. How much inventory should I hold?
> 5. Where is my cash getting stuck?
>
> The original Phase 2 builds the mechanics. This addendum makes sure those mechanics answer the right questions.

---

## RE-PRIORITIZED PRINCIPLE: Profit > Revenue

Throughout the entire codebase, when there's a tradeoff between displaying revenue and gross profit, **gross profit wins**. Revenue is a vanity metric. Gross profit is what pays the bills.

Every place that shows revenue must also show:
- Gross profit (revenue − COGS)
- Gross margin %
- Cash flow contribution where relevant

Specifically:
- Best-sellers ranked by revenue must have a parallel ranking by gross profit
- Top customers ranked by total spent must have a parallel ranking by total profit contributed
- Top suppliers must show total profit unlocked, not just total spend

## STEP 1.5 — EXTEND THE METRICS CALCULATOR

Insert this between STEP 1 and STEP 2 of the original PHASE_2.md.

A) Add columns to product_metrics via migration 0006_profit_metrics.sql:
- gross_profit_90d NUMERIC NOT NULL DEFAULT 0
- gross_margin_pct NUMERIC (already exists as real_margin_pct, rename or alias)
- inventory_turnover NUMERIC (cogs_90d / avg_inventory_value)
- avg_inventory_value NUMERIC (avg of inventory_snapshots × unit_cost over last 90d)
- cogs_90d NUMERIC (sum of qty × unit_cost from sales_order_items in last 90d)
- contribution_margin_per_unit NUMERIC (selling_price − unit_cost − avg_discount, no fees)

B) Update lib/metrics/calculator.ts to compute these in the same single SQL pass as the existing metrics. Use a single UPDATE FROM SELECT — do NOT loop per product.

C) Add to customers table via migration 0007_customer_profit.sql:
- gross_profit_lifetime NUMERIC NOT NULL DEFAULT 0
- gross_profit_90d NUMERIC NOT NULL DEFAULT 0
- avg_margin_pct NUMERIC
- payment_terms_days INTEGER (default 30, editable)
- avg_dso_days NUMERIC (days sales outstanding — how long customers take to pay)

D) Add to suppliers table via migration 0008_supplier_profit.sql:
- total_purchases_90d NUMERIC
- products_supplied INTEGER
- avg_margin_on_supplied NUMERIC (avg gross_margin_pct of products from this supplier, weighted by revenue_90d)
- last_price_change_at TIMESTAMPTZ
- price_volatility NUMERIC (stddev of unit_cost changes over last year)

E) Update recalculateCustomerMetrics(orgId) to compute customer profit:
gross_profit = sum over orders of (sum over items of (qty × (unit_price - unit_cost - per_unit_discount)))

F) Add recalculateSupplierMetrics(orgId) to compute supplier-level rollups.

G) Update the "Recalculate now" server action to call all 4 functions: products, ABC, customers, suppliers.

REPORT after STEP 1.5: paste the SQL output of:
```sql
SELECT 
  (SELECT SUM(gross_profit_90d) FROM product_metrics) as total_profit_90d,
  (SELECT SUM(revenue_90d) FROM product_metrics) as total_revenue_90d,
  (SELECT AVG(gross_margin_pct) FROM product_metrics WHERE revenue_90d > 0) as avg_margin;
```

The total_profit should be a meaningful number (not 0, not equal to revenue). If it's wrong, the calculator is broken.

---

## STEP 2.5 — RULE 09: CUSTOMER PROFITABILITY (NEW)

Insert this rule after RULE 08 in STEP 2.

This is the rule wholesale businesses care about most: which customers are actually making them money.

File: lib/decisions/rules/customer-profitability.ts

Logic:
- For each customer where total_orders >= 3:
  - Compute gross_profit_lifetime (already in customers table after STEP 1.5)
  - Compute profit_per_order = gross_profit_lifetime / total_orders
  - Compute margin_pct = gross_profit_lifetime / total_spent

- Generate alerts in three scenarios:

  Scenario A — Unprofitable big customer:
  - margin_pct < 15% AND total_spent > config.high_value_threshold (default $5000)
  - severity: orange
  - title: "{customer_name}: high revenue, low margin"
  - summary: "${revenue} spent · only {margin}% margin · ${profit} actual profit"
  - reasoning: list which products they buy and at what discount
  - suggested_action: "Renegotiate pricing or terms"
  - suggested_value: amount of profit gained if margin reached 25%

  Scenario B — Slow payer (when integrations are connected):
  - avg_dso_days > config.payment_terms_days × 1.3
  - severity: yellow
  - title: "{customer_name}: paying slowly"
  - summary: "Avg {dso} days to pay · terms are {terms} days"
  - reasoning: cash flow impact

  Scenario C — Hidden gem:
  - margin_pct > 35% AND total_spent < $2000
  - severity: green (informational, optional — could even be "opportunities" not "alerts")
  - title: "{customer_name}: high margin, low volume"
  - summary: "Buys premium products · {margin}% margin · only {orders} orders"
  - suggested_action: "Increase contact frequency or upsell"

Add this rule to engine.ts. Add default config to seed.

This rule won't run usefully without the metric calculations from STEP 1.5. Make sure those run first.

---

## STEP 5.5 — INSIGHTS PAGE: CASH FLOW (NEW)

Insert this between STEP 5D (dead stock) and STEP 6 of the original PHASE_2.md.

Create /app/(dashboard)/insights/cash/page.tsx — Cash Flow overview.

This is the single most important page for a wholesale business owner. It answers: "where is my cash right now?"

Layout:

A) HERO BAR — "Total cash position":
Three big numbers in a row:
- Cash in inventory: SUM(stock_on_hand × unit_cost) across all active products
- Cash in unsold receivables: SUM(sales_orders.total) where status='completed' AND not paid (when we have payment data) — for now, fall back to "X SKUs sold last 30 days · $Y revenue at risk if returns"
- Cash committed in open POs: SUM(purchase_orders.total) where status IN ('sent', 'confirmed')

Big total: "$X total cash deployed in working capital"

B) "Where is your cash sitting?" — donut chart (use simple SVG, no Recharts):
Slices:
- Healthy inventory (active SKUs with cover < 90d): green
- Slow inventory (60-90d cover): yellow
- Dead stock (180+d idle): red
- Open POs not received: gray
- Receivables (when available): blue

Each slice: dollar amount + % of total + click navigates to a filtered view.

C) "Cash trapped" — table of the 10 worst offenders:
- Combined view of dead stock products and overstocked products
- Columns: Product · Days idle · Cash trapped · Action button (Discount / Discontinue)
- Sorted by cash_trapped DESC

D) "Cash velocity" — by SKU:
- Inventory turnover ratio per SKU (calculated in STEP 1.5)
- Color: green if turnover > 4 (inventory cycles 4+ times/year), yellow 2-4, red < 2
- Filter by category, supplier, ABC class

E) "Working capital efficiency" — single number with context:
- Cash conversion cycle = DIO + DSO − DPO
  - DIO (Days Inventory Outstanding) = avg_inventory_value / (cogs_annualized / 365)
  - DSO (Days Sales Outstanding) = receivables / (revenue / 365) — placeholder if no payment data
  - DPO (Days Payable Outstanding) = payables / (cogs / 365) — placeholder
- For now show DIO as the main number ("Your cash sits in inventory for X days before being recovered")

F) "Cash freed up this period" — historical view:
- Last 30/60/90 days
- How much cash was freed by: completed dead stock liquidations, increased turnover, etc.
- Calculated from data_provenance and decision_alerts.completed_at

REPORT: Screenshot of cash flow page with real numbers from the demo data.

---

## STEP 5.6 — INSIGHTS PAGE: PROFITABILITY (NEW)

Insert after the cash flow page.

Create /app/(dashboard)/insights/profitability/page.tsx — Profit overview.

This page answers: "where does my profit actually come from?"

Layout:

A) HERO METRICS:
- Total gross profit last 90 days (large)
- Avg margin %
- Profit growth vs prior 90d

B) PROFIT MIX — three columns:

Left: "Profit by product"
Top 10 SKUs by gross_profit_90d. Each row: SKU · Name · Profit · Margin% · % of total profit.
Below: "These 10 SKUs generate X% of all profit." (Pareto insight)

Middle: "Profit by customer"
Top 10 customers by gross_profit_90d. Same shape.
Below: "These 10 customers generate X% of all profit."

Right: "Profit by supplier"
Suppliers ranked by total margin enabled (sum of gross profit on products they supply). Same shape.

C) UNDERPERFORMERS:
"Products generating < 15% margin":
- Table with SKU, name, current margin, suggested price for 25% margin, action button "Adjust price"

"Customers buying high-margin products at low margin":
- Customers whose avg_margin_pct < 20% but their products' baseline margin > 30%
- Implies they're getting heavy discounts

D) PROFIT HISTORY chart — daily gross profit last 90d as a sparkline.

REPORT: Screenshot.

---

## STEP 6.5 — SUPPLIER DETAIL: PROFIT VIEW

Modify STEP 6 (Supplier Detail) to add a 5th tab: "Profitability".

The tab shows:
- Total profit unlocked by this supplier (sum of gross_profit_90d for products from this supplier)
- Avg margin on products from this supplier (weighted by revenue)
- Best-margin product from this supplier
- Worst-margin product from this supplier (candidates for renegotiation)
- "Cost trend" — line of avg unit_cost from this supplier over last 12 months (if data exists)
- "Renegotiation opportunities" — products from this supplier where margin < 20%, sorted by revenue impact

This answers: "Should I keep buying from this supplier? What's the real value?"

---

## STEP 7.5 — CUSTOMER DETAIL: PROFIT VIEW

Modify STEP 7 (Customer Detail) to add a "Profit" section above the order timeline.

Show:
- Total profit lifetime (large) and avg margin %
- Profit per order (avg)
- DSO (avg days to pay) — placeholder if no payment data
- "Real customer value" — the only number that matters: gross_profit_lifetime
- Banner if margin < 15% AND total_spent > $5000: "Renegotiate this customer's pricing. They generated only $X profit on $Y revenue."

---

## STEP 8.5 — PRODUCT DETAIL: TRUE PROFITABILITY

Modify STEP 8 (Product Detail). On the Pricing tab, add below the cost breakdown:

"Real profitability"
- Gross profit per unit
- Gross margin %
- Inventory turnover (X cycles/year)
- "If you sold all current stock at current price, you'd make $X gross profit"
- "Cash currently locked in this SKU: $Y"
- "Days to recover that cash at current sales rate: Z days"

This last number is the killer insight: it tells you if a product is a cash trap.

---

## STEP 10.5 — TODAY HERO: THE 5 QUESTIONS BANNER

Modify STEP 3 (Today screen upgrade) to add a "Money lens" section at the top of /today, ABOVE the alerts.

A horizontal strip with 5 quick stats answering the 5 wholesale questions:

| Question | Answer shown |
|---|---|
| What to stock? | "X SKUs need reorder · Y new opportunities" → click goes to Pipeline |
| Best suppliers? | "Top supplier: [Name] · $X profit unlocked" → click goes to /insights/profitability |
| Best customers? | "Top customer: [Name] · $X profit · Y at risk" → click goes to customers list filtered |
| How much inventory? | "$X cash in inventory · Y% on slow movers" → click goes to /insights/cash |
| Cash stuck? | "$X in dead stock · $Y in slow movers" → click goes to /insights/dead-stock |

Each is a small card. Hover shows a sparkline of trend last 30 days.

This makes Today the "control panel" for the 5 wholesale questions.

---

## SUCCESS CRITERIA — UPDATED

Phase 2 is complete only when, opening any page, the user can answer one of the 5 wholesale questions in under 5 seconds:

- /today → "What do I do today?" + answers all 5 via the money lens strip
- /insights/cash → "Where is my cash?"
- /insights/profitability → "Where does my profit come from?"
- /insights/dead-stock → "Where is my cash trapped in stock?"
- /insights/inventory → "How much inventory do I have? How is it distributed?"
- /insights/sales → "What sells? What doesn't?"
- /insights/abc → "What's important?"
- /products/[id] → "Is this product worth keeping? Is it a cash trap?"
- /customers/[id] → "Is this customer profitable?"
- /suppliers/[id] → "Is this supplier worth it?"
- /purchases/[id] → "Should I send this PO?"

If a page does not answer one of these questions, it should not exist.

---

## EXECUTION NOTE

Read PHASE_2.md including the addendum at the bottom. Execute the original 10 steps but insert STEP 1.5, 2.5, 5.5, 5.6, 6.5, 7.5, 8.5, 10.5 as marked. The wholesale profit lens is the priority. Stop after each step.

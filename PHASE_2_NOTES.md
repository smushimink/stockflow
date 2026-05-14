# Phase 2 — Implementation Notes

## Decision rules in plain English

### Rule 01 — Reorder point
Fires when a product's `stock_on_hand` falls at or below `reorder_point`. Severity is `red` for Class A products or cover < 7 days, `orange` for cover < 14 days, `yellow` otherwise. The suggested action is to create a purchase order for `reorder_qty` units.

### Rule 02 — Dead stock
Fires when a product has had no completed sales for more than N days (configurable thresholds: 60d yellow, 90d orange, 180d red). Cash tied up (`stock_on_hand × unit_cost`) is surfaced in the alert. Suggested action: apply 50% discount or mark as discontinued.

### Rule 03 — ABC classification
Runs as a full-org recalculation (not per-product alerts). Products are ranked by revenue in the trailing 90 days: top 10% → Class A, next 30% → Class B, remaining → Class C. No alert is generated; the `abc_class` column on `products` is updated directly.

### Rule 04 — Real margin
Fires when a product's `real_margin_pct` (margin after discounts) falls below a threshold (default 15%). Severity is `red` below 5%, `orange` below 15%, `yellow` below 25%. Suggested price for 25% margin is included as `suggested_value`.

### Rule 05 — Customer churn
Fires when a customer's last order is more than `threshold_days` overdue relative to their own average reorder interval. Threshold is 1.5× the avg interval. Severity scales with how far overdue they are.

### Rule 06 — Supplier scorecard
Fires when a supplier's on-time delivery rate falls below 80% or fill rate below 90% over the last 12 months. Uses `purchase_orders` received_at vs expected_at and qty_received vs qty_ordered.

### Rule 07 — E-commerce pipeline
Fires once per week as an aggregate alert listing SKUs that are: Class A or B, margin > 20%, cover > 30 days, and not already listed online (`listed_online = false`). Single alert per org, not per product.

### Rule 08 — Seasonal pre-order
Fires when a product's historical seasonal peak is within `lookahead_days` (default 60) AND current stock is below expected peak demand. Uses same-period sales from prior year as the demand signal.

### Rule 09 — Customer profitability
Three scenarios:
- **Orange**: customer with `avg_margin_pct < 15%` AND `total_spent_90d > $5000` — low margin, high volume, candidate for renegotiation.
- **Yellow**: customer with `avg_dso_days > payment_terms_days × 1.3` — slow payer damaging cash flow.
- **Green** (informational): customer with `avg_margin_pct > 35%` AND `total_spent_90d < $2000` — hidden gem, worth nurturing.

---

## How to add a 10th rule

1. Create `lib/decisions/rules/my-rule.ts` implementing this shape:

```typescript
import type { DecisionRule } from "@/lib/decisions/types";
import { createClient } from "@/lib/supabase/server";

export const myRule: DecisionRule = {
  rule_type: "my_rule",
  defaultConfig: {
    threshold: 100,
  },
  async evaluate(orgId: string, config: Record<string, unknown>) {
    const supabase = await createClient();
    // Query your data
    const { data } = await supabase
      .from("products")
      .select("id, name, ...")
      .eq("organization_id", orgId);

    const alerts = [];
    for (const row of data ?? []) {
      // Build alert object
      alerts.push({
        organization_id: orgId,
        rule_type: "my_rule",
        severity: "orange" as const,
        status: "pending" as const,
        title: `My rule fired for ${row.name}`,
        summary: "Plain English explanation for the business owner",
        reasoning: "Why this matters",
        suggested_action: "What to do",
        suggested_value: null,
        suggested_qty: null,
        related_product_id: row.id,
        related_customer_id: null,
        related_supplier_id: null,
        metadata: { /* extra data for the card detail grid */ },
      });
    }
    return alerts;
  },
};
```

2. Register it in `lib/decisions/engine.ts`:
```typescript
import { myRule } from "./rules/my-rule";
// Add to the rules array:
const RULES: DecisionRule[] = [
  ...,
  myRule,
];
```

3. Add a row to `decision_rules` in the database (or seed):
```sql
INSERT INTO decision_rules (organization_id, rule_type, enabled, config)
VALUES ('<org_id>', 'my_rule', true, '{"threshold": 100}');
```

4. Add the display label in `components/rules/rules-client.tsx`:
```typescript
const RULE_META = {
  ...,
  my_rule: {
    label: "10 My rule",
    description: "Brief description for the Rules page",
    configurable: false, // set true to add a config panel
  },
};
```

5. Add a `DetailGrid` case in `components/today/action-card.tsx` if the alert has a custom data grid.

---

## Known limitations

### Metrics simplifications
- **Real margin** (`real_margin_pct`) uses `(selling_price − unit_cost − avg_discount) / selling_price`. It does not include freight, duties, storage, or shrinkage costs. These are typically tracked at the order level but not yet modelled in ArachNet.
- **Unit cost** is the last recorded cost price on the `products` table, not a weighted average of inventory layers (FIFO/AVCO). If costs fluctuate frequently, `product_metrics.cogs_90d` may understate or overstate actual COGS.
- **Avg inventory value** uses current `stock_on_hand × unit_cost` as a proxy; it does not use historical inventory snapshots.

### Seasonal demand
- Seasonal pre-order rule (Rule 08) uses same-period sales from the prior year. With only ~90 days of seeded data, this rule will not fire unless historical data is loaded via CSV import.

### Payment terms / DSO
- `avg_dso_days` on customers is populated by `recalculate_customer_metrics` but requires sales orders to have a `paid_at` timestamp. Current data model has `paid_at` as nullable; without payment date data, DSO defaults to NULL and the Rule 09 slow-payer scenario will not fire.

### ABC recalculation
- ABC runs on trailing 90-day revenue. Newly imported products with no sales history default to Class C regardless of true importance. Manual override is not yet supported.

### Multi-currency
- All monetary values are stored and displayed in AUD. Multi-currency support would require a `currency` column on `products` and `sales_orders` plus a FX rate table.

### Bulk operations
- "Apply 50% discount to dead stock" (`/api/products/bulk`) uses a per-product UPDATE loop rather than a single SQL UPDATE FROM. For large catalogs (1000+ SKUs), this could time out. Migration to a single `UPDATE products SET selling_price = selling_price * 0.5 WHERE id = ANY($1)` is the recommended fix.

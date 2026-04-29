import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

interface DeadStockConfig {
  yellow_days?: number;
  orange_days?: number;
  red_days?: number;
}

export const deadStockRule: DecisionRule = {
  rule_type: "dead_stock",
  defaultConfig: { yellow_days: 60, orange_days: 90, red_days: 180 },

  async evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]> {
    const { yellow_days = 60, orange_days = 90, red_days = 180 } = config as DeadStockConfig;

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id,
        days_since_last_sale,
        cash_tied_up,
        products (
          id, sku, name, selling_price, unit_cost, stock_on_hand, category,
          suppliers (name)
        )
      `)
      .eq("organization_id", orgId)
      .gt("cash_tied_up", 0)
      .not("days_since_last_sale", "is", null);

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const m of metrics ?? []) {
      const days = m.days_since_last_sale as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawProduct = m.products;
      const product = (Array.isArray(rawProduct) ? (rawProduct as unknown[])[0] : rawProduct) as {
        id: string; sku: string; name: string; selling_price: number;
        unit_cost: number; stock_on_hand: number; category: string | null;
        suppliers: { name: string } | { name: string }[] | null;
      } | null;

      if (!product || days < yellow_days) continue;

      let severity: Alert["severity"];
      if (days >= red_days) severity = "red";
      else if (days >= orange_days) severity = "orange";
      else severity = "yellow";

      const suppliersRaw = product.suppliers;
      const supplierObj = Array.isArray(suppliersRaw) ? suppliersRaw[0] : suppliersRaw;
      const supplierName = supplierObj?.name ?? "Unknown supplier";
      const discountedPrice = product.selling_price * 0.5;
      const cashToFree = (m.cash_tied_up as number);

      alerts.push({
        organization_id: orgId,
        rule_type: "dead_stock",
        related_product_id: product.id,
        severity,
        title: `${product.name} — ${days}d no sales`,
        summary: `${product.stock_on_hand} units unsold for ${days} days. $${cashToFree.toFixed(0)} tied up.`,
        reasoning: `Last sale was ${days} days ago. With ${product.stock_on_hand} units at $${product.unit_cost.toFixed(2)} cost, you have $${cashToFree.toFixed(0)} in cash tied up that could be working elsewhere. Threshold for this severity: ${severity === "red" ? red_days : severity === "orange" ? orange_days : yellow_days}+ days.`,
        suggested_action: "Discount 50% and move to clearance",
        suggested_value: discountedPrice,
        metadata: {
          days_since_last_sale: days,
          cash_tied_up: cashToFree,
          stock_on_hand: product.stock_on_hand,
          current_price: product.selling_price,
          discounted_price: discountedPrice,
          supplier: supplierName,
          sku: product.sku,
        },
      });
    }

    // Sort: red first, then by cash tied up descending
    alerts.sort((a, b) => {
      const order = { red: 0, orange: 1, yellow: 2, green: 3 };
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return (b.metadata.cash_tied_up as number) - (a.metadata.cash_tied_up as number);
    });

    return alerts;
  },
};

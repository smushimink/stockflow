import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface DeadStockConfig {
  yellow_days?: number;
  orange_days?: number;
  red_days?: number;
}

export const deadStockRule: DecisionRule = {
  rule_type: "dead_stock",
  defaultConfig: { yellow_days: 60, orange_days: 90, red_days: 180 },

  async evaluate({ orgId, config, businessContext }: RuleContext): Promise<Alert[]> {
    let { yellow_days = 60, orange_days = 90, red_days = 180 } = config as DeadStockConfig;

    // For perishable businesses, scale thresholds off shelf life rather than hardcoded defaults
    const isPerishableScaled = businessContext.products_perishable && businessContext.avg_shelf_life_days;
    if (isPerishableScaled) {
      const shelf = businessContext.avg_shelf_life_days!;
      yellow_days = Math.round(shelf * 0.33);
      orange_days = Math.round(shelf * 0.5);
      red_days = Math.round(shelf * 0.7);
    }

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id,
        days_since_last_sale,
        cash_tied_up,
        products (
          id, sku, name, selling_price, unit_cost, stock_on_hand, category, rule_overrides,
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
        rule_overrides: Record<string, Record<string, unknown>> | null;
        suppliers: { name: string } | { name: string }[] | null;
      } | null;

      if (!product) continue;

      // Merge per-product rule overrides (product wins over org config)
      const productOverrides = (product.rule_overrides?.dead_stock) ?? {};
      const eff_yellow_days = (productOverrides.yellow_days as number | undefined) ?? yellow_days;
      const eff_orange_days = (productOverrides.orange_days as number | undefined) ?? orange_days;
      const eff_red_days = (productOverrides.red_days as number | undefined) ?? red_days;

      if (days < eff_yellow_days) continue;

      let severity: Alert["severity"];
      if (days >= eff_red_days) severity = "red";
      else if (days >= eff_orange_days) severity = "orange";
      else severity = "yellow";

      const suppliersRaw = product.suppliers;
      const supplierObj = Array.isArray(suppliersRaw) ? suppliersRaw[0] : suppliersRaw;
      const supplierName = supplierObj?.name ?? "Unknown supplier";
      const discountedPrice = product.selling_price * 0.5;
      const cashToFree = m.cash_tied_up as number;

      const thresholdUsed = severity === "red" ? eff_red_days : severity === "orange" ? eff_orange_days : eff_yellow_days;
      const hasProductOverride = Object.keys(productOverrides).length > 0;

      // ── Reasoning trail ──────────────────────────────────────────────────────

      const trail: ReasoningSegment[] = [
        {
          type: "data",
          label: "Idle days",
          text: `No sales recorded in ${days} days.`,
        },
        {
          type: "data",
          label: "Inventory value",
          text: `${product.stock_on_hand} units @ $${product.unit_cost.toFixed(2)} cost = $${cashToFree.toFixed(0)} cash tied up (selling at $${product.selling_price.toFixed(2)}).`,
        },
        {
          type: "rule",
          label: "Threshold",
          text: `${severity === "red" ? "Urgent" : severity === "orange" ? "Action" : "Monitor"} threshold: ${thresholdUsed}+ days idle.${hasProductOverride ? " (product override)" : isPerishableScaled ? ` (scaled to shelf life ${businessContext.avg_shelf_life_days}d)` : " (org default)"}`,
        },
        ...(isPerishableScaled
          ? [{ type: "context" as const, label: "Perishable", text: `Perishable business: thresholds scaled to avg shelf life (${businessContext.avg_shelf_life_days}d × 0.33/0.5/0.7).` }]
          : []),
        ...(hasProductOverride
          ? [{ type: "context" as const, label: "Product override", text: `Per-product override active: ${Object.entries(productOverrides).map(([k, v]) => `${k}=${v}`).join(", ")}.` }]
          : []),
        {
          type: "calc",
          label: "Discount scenario",
          text: `50% discount → $${discountedPrice.toFixed(2)}/unit. ${product.selling_price > product.unit_cost * 2 ? `Still above cost ($${product.unit_cost.toFixed(2)}) — discount feasible.` : `Below cost basis — full clearance may realise a loss.`}`,
        },
        {
          type: "verdict",
          label: "Trigger",
          text: `${days}d idle triggers ${severity} alert. $${cashToFree.toFixed(0)} working capital opportunity if cleared.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "dead_stock",
        related_product_id: product.id,
        severity,
        title: `${product.name} — ${days}d no sales`,
        summary: `${product.stock_on_hand} units unsold for ${days} days. $${cashToFree.toFixed(0)} tied up.`,
        reasoning: segmentsToText(trail),
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
          threshold_used: thresholdUsed,
          reasoning_trail: trail,
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

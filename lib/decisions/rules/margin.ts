import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

interface MarginConfig {
  red_threshold?: number;
  yellow_threshold?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

export const marginRule: DecisionRule = {
  rule_type: "real_margin",
  defaultConfig: { red_threshold: 0.15, yellow_threshold: 0.25 },

  async evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]> {
    const { red_threshold = 0.15, yellow_threshold = 0.25 } = config as MarginConfig;

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id, real_margin_pct, real_unit_cost, avg_discount, avg_platform_fee,
        products (
          id, sku, name, selling_price, unit_cost, status
        )
      `)
      .eq("organization_id", orgId)
      .lt("real_margin_pct", yellow_threshold);

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const m of metrics ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = firstOf(m.products as any);
      if (!product || product.status !== "active") continue;

      const margin = m.real_margin_pct as number;
      const selling = product.selling_price as number;
      const cost = m.real_unit_cost as number;
      const discount = m.avg_discount as number;
      const platform_fee = m.avg_platform_fee as number;

      const severity: Alert["severity"] = margin < red_threshold ? "red" : "yellow";

      const suggested_price = selling > 0
        ? (cost + platform_fee + discount) / (1 - yellow_threshold)
        : 0;

      alerts.push({
        organization_id: orgId,
        rule_type: "real_margin",
        related_product_id: product.id as string,
        severity,
        title: `Low margin ${product.sku as string}`,
        summary: `${(margin * 100).toFixed(1)}% margin · selling $${selling.toFixed(2)} · cost $${cost.toFixed(2)}`,
        reasoning: `Cost $${cost.toFixed(2)} + avg discount $${discount.toFixed(2)} + platform fee $${platform_fee.toFixed(2)} = $${(cost + discount + platform_fee).toFixed(2)} against selling price $${selling.toFixed(2)}. Margin ${(margin * 100).toFixed(1)}% is below ${(yellow_threshold * 100).toFixed(0)}% target.`,
        suggested_action: `Adjust price to reach ${(yellow_threshold * 100).toFixed(0)}% margin`,
        suggested_value: Math.round(suggested_price * 100) / 100,
        metadata: {
          current_price: selling,
          suggested_price: Math.round(suggested_price * 100) / 100,
          real_unit_cost: cost,
          avg_discount: discount,
          avg_platform_fee: platform_fee,
          real_margin_pct: margin,
          sku: product.sku,
        },
      });
    }

    alerts.sort((a, b) => (a.metadata.real_margin_pct as number) - (b.metadata.real_margin_pct as number));

    return alerts;
  },
};

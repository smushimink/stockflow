import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

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

  async evaluate({ orgId, config }: RuleContext): Promise<Alert[]> {
    const { red_threshold = 0.15, yellow_threshold = 0.25 } = config as MarginConfig;

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id, real_margin_pct, real_unit_cost, avg_discount, avg_platform_fee,
        avg_daily_sales_30d,
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
      const cost = (m.real_unit_cost as number) ?? (product.unit_cost as number);
      const discount = (m.avg_discount as number) ?? 0;
      const platform_fee = (m.avg_platform_fee as number) ?? 0;
      const avgDaily = (m.avg_daily_sales_30d as number) ?? 0;

      const severity: Alert["severity"] = margin < red_threshold ? "red" : "yellow";

      const totalCost = cost + discount + platform_fee;
      const suggested_price = selling > 0
        ? (cost + platform_fee + discount) / (1 - yellow_threshold)
        : 0;

      const monthlyContrib = avgDaily > 0 ? avgDaily * 30 * (selling - totalCost) : null;
      const targetContrib = avgDaily > 0 ? avgDaily * 30 * selling * yellow_threshold : null;

      // ── Reasoning trail ──────────────────────────────────────────────────────

      const trail: ReasoningSegment[] = [
        {
          type: "data",
          label: "Cost breakdown",
          text: `Unit cost: $${cost.toFixed(2)}${discount > 0 ? ` + avg discount: $${discount.toFixed(2)}` : ""}${platform_fee > 0 ? ` + platform fee: $${platform_fee.toFixed(2)}` : ""} = total cost $${totalCost.toFixed(2)}.`,
        },
        {
          type: "data",
          label: "Selling price",
          text: `Selling price: $${selling.toFixed(2)}.`,
        },
        {
          type: "calc",
          label: "Real margin",
          text: `Margin = ($${selling.toFixed(2)} − $${totalCost.toFixed(2)}) / $${selling.toFixed(2)} = ${(margin * 100).toFixed(1)}%.`,
        },
        {
          type: "rule",
          label: "Threshold",
          text: `${severity === "red" ? "Red" : "Yellow"} threshold: ${severity === "red" ? (red_threshold * 100).toFixed(0) : (yellow_threshold * 100).toFixed(0)}% margin.`,
        },
        ...(suggested_price > 0
          ? [{
              type: "calc" as const,
              label: "Suggested price",
              text: `To reach ${(yellow_threshold * 100).toFixed(0)}% margin: price → $${suggested_price.toFixed(2)} (covering full cost + fees at target margin).`,
            }]
          : []),
        ...(monthlyContrib !== null && targetContrib !== null
          ? [{
              type: "data" as const,
              label: "Contribution",
              text: `At ${avgDaily.toFixed(1)} units/day: current monthly contribution $${monthlyContrib.toFixed(0)} vs target $${targetContrib.toFixed(0)}.`,
            }]
          : []),
        {
          type: "verdict",
          label: "Trigger",
          text: `Margin ${(margin * 100).toFixed(1)}% is ${margin < red_threshold ? "critically " : ""}below ${(yellow_threshold * 100).toFixed(0)}% target. Adjust price or renegotiate cost.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "real_margin",
        related_product_id: product.id as string,
        severity,
        title: `Low margin ${product.sku as string}`,
        summary: `${(margin * 100).toFixed(1)}% margin · selling $${selling.toFixed(2)} · cost $${cost.toFixed(2)}`,
        reasoning: segmentsToText(trail),
        suggested_action: `Adjust price to reach ${(yellow_threshold * 100).toFixed(0)}% margin`,
        suggested_value: Math.round(suggested_price * 100) / 100,
        metadata: {
          current_price: selling,
          suggested_price: Math.round(suggested_price * 100) / 100,
          real_unit_cost: cost,
          cost,
          avg_discount: discount,
          avg_platform_fee: platform_fee,
          real_margin_pct: margin,
          target_margin: yellow_threshold,
          avg_daily_sales: avgDaily,
          sku: product.sku,
          reasoning_trail: trail,
        },
      });
    }

    alerts.sort((a, b) => (a.metadata.real_margin_pct as number) - (b.metadata.real_margin_pct as number));

    return alerts;
  },
};

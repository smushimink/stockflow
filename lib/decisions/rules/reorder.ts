import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

interface ReorderConfig {
  safety_factor?: number;
  target_cover_days?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

const SEV_ORDER = { red: 0, orange: 1, yellow: 2, green: 3 } as const;

export const reorderRule: DecisionRule = {
  rule_type: "reorder",
  defaultConfig: { safety_factor: 1.3, target_cover_days: 30 },

  async evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]> {
    const { safety_factor = 1.3, target_cover_days = 30 } = config as ReorderConfig;

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id,
        avg_daily_sales_30d, avg_daily_sales_7d, days_of_cover,
        products (
          id, sku, name, unit_cost, stock_on_hand,
          lead_time_days, moq, status,
          suppliers ( id, name, lead_time_days )
        )
      `)
      .eq("organization_id", orgId);

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const m of metrics ?? []) {
      const product = firstOf(
        m.products as
          | { id: string; sku: string; name: string; unit_cost: number; stock_on_hand: number; lead_time_days: number | null; moq: number | null; status: string; suppliers: unknown }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | any
      );
      if (!product || product.status !== "active") continue;

      const avg_daily =
        (m.avg_daily_sales_30d as number) > 0
          ? (m.avg_daily_sales_30d as number)
          : (m.avg_daily_sales_7d as number);
      if (avg_daily <= 0) continue;

      const supplier = firstOf(product.suppliers as { id: string; name: string; lead_time_days: number } | { id: string; name: string; lead_time_days: number }[] | null);
      const lead_time: number = product.lead_time_days ?? supplier?.lead_time_days ?? 14;
      const reorder_point = avg_daily * lead_time * safety_factor;

      if ((product.stock_on_hand as number) > reorder_point) continue;

      const days_of_cover = m.days_of_cover as number;
      const moq = (product.moq as number | null) ?? 1;
      const suggested_qty = Math.max(
        moq,
        Math.ceil(avg_daily * target_cover_days - (product.stock_on_hand as number))
      );

      let severity: Alert["severity"];
      if (days_of_cover < lead_time) severity = "red";
      else if (days_of_cover < lead_time * 1.5) severity = "orange";
      else severity = "yellow";

      const supplier_name = supplier?.name ?? "Unknown supplier";

      alerts.push({
        organization_id: orgId,
        rule_type: "reorder",
        related_product_id: product.id as string,
        severity,
        title: `Reorder ${product.sku as string}`,
        summary: `${suggested_qty} units from ${supplier_name} · runs out in ${Math.floor(days_of_cover)}d`,
        reasoning: `Selling ${avg_daily.toFixed(1)}/day. Lead time ${lead_time}d. Reorder point ${Math.ceil(reorder_point)} units. Currently at ${product.stock_on_hand as number}.`,
        suggested_action: "Create purchase order",
        suggested_value: suggested_qty * (product.unit_cost as number),
        suggested_qty,
        metadata: {
          avg_daily_sales: avg_daily,
          lead_time_days: lead_time,
          days_of_cover,
          supplier_name,
          supplier_id: supplier?.id ?? null,
          reorder_point: Math.ceil(reorder_point),
          stock_on_hand: product.stock_on_hand,
          sku: product.sku,
        },
      });
    }

    alerts.sort((a, b) => {
      const sd = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (sd !== 0) return sd;
      return (a.metadata.days_of_cover as number) - (b.metadata.days_of_cover as number);
    });

    return alerts;
  },
};

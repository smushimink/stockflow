import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

interface ChurnConfig {
  churn_factor?: number;
  min_orders?: number;
}

export const churnRule: DecisionRule = {
  rule_type: "customer_churn",
  defaultConfig: { churn_factor: 1.5, min_orders: 3 },

  async evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]> {
    const { churn_factor = 1.5, min_orders = 3 } = config as ChurnConfig;

    const supabase = createAdminClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, name, total_orders, total_spent, last_order_at, avg_order_interval_days")
      .eq("organization_id", orgId)
      .eq("active", true)
      .gte("total_orders", min_orders)
      .not("avg_order_interval_days", "is", null)
      .not("last_order_at", "is", null);

    if (error) throw error;

    const now = Date.now();
    const alerts: Alert[] = [];

    for (const c of customers ?? []) {
      const avg_interval = c.avg_order_interval_days as number;
      const last_order_at = c.last_order_at as string;
      const days_since = Math.floor((now - new Date(last_order_at).getTime()) / (24 * 3600 * 1000));
      const threshold = avg_interval * churn_factor;

      if (days_since <= threshold) continue;

      alerts.push({
        organization_id: orgId,
        rule_type: "customer_churn",
        related_customer_id: c.id as string,
        severity: "orange",
        title: `Customer at risk: ${c.name as string}`,
        summary: `${days_since}d since last order · normally every ${Math.round(avg_interval)}d`,
        reasoning: `${c.name as string} usually orders every ${Math.round(avg_interval)} days. It has been ${days_since} days since their last order — ${(days_since / avg_interval).toFixed(1)}× their normal interval. Churn threshold: ${threshold.toFixed(0)} days.`,
        suggested_action: "Mark as contacted",
        suggested_value: c.total_spent as number,
        metadata: {
          days_since_last_order: days_since,
          avg_order_interval_days: avg_interval,
          threshold_days: Math.round(threshold),
          total_orders: c.total_orders,
          total_spent: c.total_spent,
          last_order_at,
          customer_name: c.name,
        },
      });
    }

    alerts.sort(
      (a, b) => (b.metadata.days_since_last_order as number) - (a.metadata.days_since_last_order as number)
    );

    return alerts;
  },
};

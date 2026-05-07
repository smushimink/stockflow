import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface ChurnConfig {
  churn_factor?: number;
  min_orders?: number;
}

export const churnRule: DecisionRule = {
  rule_type: "customer_churn",
  defaultConfig: { churn_factor: 1.5, min_orders: 3 },

  async evaluate({ orgId, config }: RuleContext): Promise<Alert[]> {
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

      const overdueFactor = days_since / avg_interval;
      const lastOrderLabel = new Date(last_order_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

      const trail: ReasoningSegment[] = [
        {
          type: "data",
          label: "Order history",
          text: `${c.total_orders} lifetime orders · avg $${((c.total_spent as number) / (c.total_orders as number)).toFixed(0)}/order · total spent $${Math.round(c.total_spent as number).toLocaleString("en-AU")}.`,
        },
        {
          type: "data",
          label: "Order pattern",
          text: `Average order interval: ${Math.round(avg_interval)} days. Last order: ${lastOrderLabel} (${days_since} days ago).`,
        },
        {
          type: "rule",
          label: "Churn factor",
          text: `Churn threshold = avg interval × ${churn_factor} = ${Math.round(avg_interval)} × ${churn_factor} = ${threshold.toFixed(0)} days.`,
        },
        {
          type: "calc",
          label: "Overdue",
          text: `${days_since} days since last order = ${overdueFactor.toFixed(1)}× their normal interval.`,
        },
        {
          type: "verdict",
          label: "Trigger",
          text: `Exceeded ${threshold.toFixed(0)}-day threshold by ${(days_since - threshold).toFixed(0)} days. Customer likely churning.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "customer_churn",
        related_customer_id: c.id as string,
        severity: "orange",
        title: `Customer at risk: ${c.name as string}`,
        summary: `${days_since}d since last order · normally every ${Math.round(avg_interval)}d`,
        reasoning: segmentsToText(trail),
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
          reasoning_trail: trail,
        },
      });
    }

    alerts.sort(
      (a, b) => (b.metadata.days_since_last_order as number) - (a.metadata.days_since_last_order as number)
    );

    return alerts;
  },
};

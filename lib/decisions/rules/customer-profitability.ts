import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface CustomerProfitConfig {
  high_value_threshold?: number;
  low_margin_threshold?: number;
  payment_warning_ratio?: number;
  hidden_gem_margin?: number;
  hidden_gem_max_spend?: number;
  target_margin?: number;
}

function fmt(v: number): string {
  return `$${Math.round(v).toLocaleString("en-AU")}`;
}

export const customerProfitabilityRule: DecisionRule = {
  rule_type: "customer_profitability",
  defaultConfig: {
    high_value_threshold: 5000,
    low_margin_threshold: 0.15,
    payment_warning_ratio: 1.3,
    hidden_gem_margin: 0.35,
    hidden_gem_max_spend: 2000,
    target_margin: 0.25,
  },

  async evaluate({ orgId, config, businessContext }: RuleContext): Promise<Alert[]> {
    const {
      high_value_threshold = 5000,
      low_margin_threshold = 0.15,
      payment_warning_ratio = 1.3,
      hidden_gem_margin = 0.35,
      hidden_gem_max_spend = 2000,
      target_margin = 0.25,
    } = config as CustomerProfitConfig;

    const supabase = createAdminClient();

    const { data: customers, error } = await supabase
      .from("customers")
      .select(
        "id, name, total_orders, total_spent, gross_profit_lifetime, avg_margin_pct, payment_terms_days, avg_dso_days"
      )
      .eq("organization_id", orgId)
      .gte("total_orders", 3)
      .eq("active", true);

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const customer of customers ?? []) {
      const name = customer.name as string;
      const spent = (customer.total_spent as number) ?? 0;
      const profit = (customer.gross_profit_lifetime as number) ?? 0;
      const margin = (customer.avg_margin_pct as number) ?? (spent > 0 ? profit / spent : 0);
      const orders = (customer.total_orders as number) ?? 0;
      const paymentTerms = (customer.payment_terms_days as number) ?? businessContext.payment_terms_default_days;
      const dso = customer.avg_dso_days as number | null;

      // Scenario A — high revenue, low margin
      if (margin < (low_margin_threshold as number) && spent > (high_value_threshold as number)) {
        const potentialGain = spent * (target_margin as number) - profit;

        const trail: ReasoningSegment[] = [
          {
            type: "data",
            label: "Revenue & profit",
            text: `${orders} lifetime orders · ${fmt(spent)} revenue · ${fmt(profit)} gross profit.`,
          },
          {
            type: "calc",
            label: "Effective margin",
            text: `Effective margin = ${fmt(profit)} / ${fmt(spent)} = ${(margin * 100).toFixed(1)}%.`,
          },
          {
            type: "rule",
            label: "Thresholds",
            text: `Low margin threshold: ${(low_margin_threshold * 100).toFixed(0)}%. High value threshold: ${fmt(high_value_threshold as number)}.`,
          },
          {
            type: "calc",
            label: "Upside",
            text: `Reaching ${(target_margin * 100).toFixed(0)}% target margin would add ${fmt(Math.max(0, potentialGain))} profit on existing revenue.`,
          },
          {
            type: "verdict",
            label: "Trigger",
            text: `High-value customer (${fmt(spent)} revenue) with only ${(margin * 100).toFixed(1)}% margin — below ${(low_margin_threshold * 100).toFixed(0)}% threshold. Renegotiate pricing or terms.`,
          },
        ];

        alerts.push({
          organization_id: orgId,
          rule_type: "customer_profitability",
          related_customer_id: customer.id as string,
          severity: "orange",
          title: `${name}: high revenue, low margin`,
          summary: `${fmt(spent)} spent · only ${(margin * 100).toFixed(1)}% margin · ${fmt(profit)} actual profit`,
          reasoning: segmentsToText(trail),
          suggested_action: "Renegotiate pricing or terms",
          suggested_value: Math.max(0, Math.round(potentialGain)),
          metadata: {
            total_spent: spent,
            gross_profit_lifetime: profit,
            avg_margin_pct: margin,
            total_orders: orders,
            potential_gain: Math.max(0, Math.round(potentialGain)),
            reasoning_trail: trail,
          },
        });
      }

      // Scenario B — slow payer
      if (dso !== null && dso > (paymentTerms as number) * (payment_warning_ratio as number)) {
        const daysOver = Math.round(dso - paymentTerms);

        const trail: ReasoningSegment[] = [
          {
            type: "data",
            label: "Payment data",
            text: `Customer avg DSO (days sales outstanding): ${Math.round(dso)} days.`,
          },
          {
            type: "context",
            label: "Payment terms",
            text: `Payment terms: ${paymentTerms} days (${businessContext.payment_terms_default_days === paymentTerms ? "org default" : "customer-specific"}).`,
          },
          {
            type: "rule",
            label: "Warning ratio",
            text: `Payment warning triggers when DSO > terms × ${payment_warning_ratio} = ${(paymentTerms * payment_warning_ratio).toFixed(0)} days.`,
          },
          {
            type: "calc",
            label: "Overdue",
            text: `${Math.round(dso)}d actual vs ${paymentTerms}d terms = ${daysOver}d average overdue. This ties up working capital.`,
          },
          {
            type: "verdict",
            label: "Trigger",
            text: `DSO ${Math.round(dso)}d exceeds ${(paymentTerms * payment_warning_ratio).toFixed(0)}-day warning threshold. Follow up on outstanding invoices.`,
          },
        ];

        alerts.push({
          organization_id: orgId,
          rule_type: "customer_profitability",
          related_customer_id: customer.id as string,
          severity: "yellow",
          title: `${name}: paying slowly`,
          summary: `Avg ${Math.round(dso)} days to pay · terms are ${paymentTerms} days`,
          reasoning: segmentsToText(trail),
          suggested_action: "Follow up on outstanding invoices",
          metadata: {
            avg_dso_days: dso,
            payment_terms_days: paymentTerms,
            days_overdue: daysOver,
            reasoning_trail: trail,
          },
        });
      }

      // Scenario C — hidden gem
      if (margin > (hidden_gem_margin as number) && spent < (hidden_gem_max_spend as number)) {
        const trail: ReasoningSegment[] = [
          {
            type: "data",
            label: "Profile",
            text: `${orders} orders · ${fmt(spent)} lifetime spend · ${(margin * 100).toFixed(1)}% gross margin.`,
          },
          {
            type: "rule",
            label: "Hidden gem criteria",
            text: `Hidden gem: margin > ${(hidden_gem_margin * 100).toFixed(0)}% AND lifetime spend < ${fmt(hidden_gem_max_spend as number)}.`,
          },
          {
            type: "calc",
            label: "Upside",
            text: `If spend doubled to ${fmt(spent * 2)}: estimated ${fmt(spent * 2 * margin)} profit at current margin.`,
          },
          {
            type: "verdict",
            label: "Trigger",
            text: `High-margin (${(margin * 100).toFixed(1)}%) customer with low engagement. Increasing order frequency is high-ROI.`,
          },
        ];

        alerts.push({
          organization_id: orgId,
          rule_type: "customer_profitability",
          related_customer_id: customer.id as string,
          severity: "green",
          title: `${name}: high margin, low volume`,
          summary: `Buys premium products · ${(margin * 100).toFixed(1)}% margin · only ${orders} orders`,
          reasoning: segmentsToText(trail),
          suggested_action: "Increase contact frequency or upsell",
          metadata: {
            total_spent: spent,
            avg_margin_pct: margin,
            total_orders: orders,
            reasoning_trail: trail,
          },
        });
      }
    }

    return alerts;
  },
};

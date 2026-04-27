import { createAdminClient } from "@/lib/supabase/admin";
import { deadStockRule } from "@/lib/decisions/rules/dead-stock";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

const registeredRules: DecisionRule[] = [deadStockRule];

export async function runEngine(orgId: string): Promise<{ newAlerts: number; total: number }> {
  const supabase = createAdminClient();

  const { data: rules } = await supabase
    .from("decision_rules")
    .select("rule_type, enabled, config")
    .eq("organization_id", orgId)
    .eq("enabled", true);

  if (!rules?.length) return { newAlerts: 0, total: 0 };

  const enabledTypes = new Set(rules.map((r) => r.rule_type));
  const ruleConfigs = Object.fromEntries(rules.map((r) => [r.rule_type, r.config as Record<string, unknown>]));

  let allAlerts: Alert[] = [];

  for (const rule of registeredRules) {
    if (!enabledTypes.has(rule.rule_type)) continue;
    const config = ruleConfigs[rule.rule_type] ?? {};
    const alerts = await rule.evaluate(orgId, config);
    allAlerts = allAlerts.concat(alerts);
  }

  if (!allAlerts.length) return { newAlerts: 0, total: 0 };

  // Upsert alerts — replace pending alerts for same rule_type + product
  let newCount = 0;

  for (const alert of allAlerts) {
    const { data: existing } = await supabase
      .from("decision_alerts")
      .select("id, status")
      .eq("organization_id", orgId)
      .eq("rule_type", alert.rule_type)
      .eq("related_product_id", alert.related_product_id ?? null)
      .eq("status", "pending")
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from("decision_alerts")
        .update({
          severity: alert.severity,
          title: alert.title,
          summary: alert.summary,
          reasoning: alert.reasoning,
          suggested_action: alert.suggested_action ?? null,
          suggested_value: alert.suggested_value ?? null,
          suggested_qty: alert.suggested_qty ?? null,
          metadata: alert.metadata,
        })
        .eq("id", existing.id);
    } else {
      const { error } = await supabase.from("decision_alerts").insert({
        organization_id: orgId,
        rule_type: alert.rule_type,
        related_product_id: alert.related_product_id ?? null,
        related_customer_id: alert.related_customer_id ?? null,
        related_supplier_id: alert.related_supplier_id ?? null,
        severity: alert.severity,
        status: "pending",
        title: alert.title,
        summary: alert.summary,
        reasoning: alert.reasoning,
        suggested_action: alert.suggested_action ?? null,
        suggested_value: alert.suggested_value ?? null,
        suggested_qty: alert.suggested_qty ?? null,
        metadata: alert.metadata,
      });
      if (!error) newCount++;
    }
  }

  return { newAlerts: newCount, total: allAlerts.length };
}

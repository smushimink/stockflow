import { createAdminClient } from "@/lib/supabase/admin";
import { deadStockRule } from "@/lib/decisions/rules/dead-stock";
import { reorderRule } from "@/lib/decisions/rules/reorder";
import { abcRule } from "@/lib/decisions/rules/abc";
import { marginRule } from "@/lib/decisions/rules/margin";
import { churnRule } from "@/lib/decisions/rules/churn";
import { supplierScorecardRule } from "@/lib/decisions/rules/supplier-score";
import { ecommercePipelineRule } from "@/lib/decisions/rules/ecommerce-pipeline";
import { seasonalForecastRule } from "@/lib/decisions/rules/seasonal-forecast";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

const registeredRules: DecisionRule[] = [
  reorderRule,
  deadStockRule,
  abcRule,
  marginRule,
  churnRule,
  supplierScorecardRule,
  ecommercePipelineRule,
  seasonalForecastRule,
];

async function upsertAlert(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  alert: Alert
): Promise<boolean> {
  // Find an existing pending or snoozed alert for this exact entity
  let query = supabase
    .from("decision_alerts")
    .select("id, status, snooze_until")
    .eq("organization_id", orgId)
    .eq("rule_type", alert.rule_type)
    .in("status", ["pending", "snoozed"]);

  if (alert.related_product_id) {
    query = query.eq("related_product_id", alert.related_product_id);
  } else if (alert.related_customer_id) {
    query = query.eq("related_customer_id", alert.related_customer_id);
  } else if (alert.related_supplier_id) {
    query = query.eq("related_supplier_id", alert.related_supplier_id);
  } else {
    // Aggregate alert — match on rule_type with no related entities
    query = query.is("related_product_id", null).is("related_customer_id", null).is("related_supplier_id", null);
  }

  const { data: existing } = await query.limit(1).maybeSingle();

  if (existing) {
    // If snoozed and snooze window still active, skip
    if (
      existing.status === "snoozed" &&
      existing.snooze_until &&
      new Date(existing.snooze_until as string) > new Date()
    ) {
      return false;
    }

    // Pending (or snoozed but expired) — update in place
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
        status: "pending",
        snooze_until: null,
      })
      .eq("id", existing.id as string);

    return false; // not a new alert
  }

  // Insert new alert
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

  return !error;
}

export async function runEngine(orgId: string): Promise<{
  newAlerts: number;
  total: number;
  byRule: Record<string, number>;
}> {
  const supabase = createAdminClient();

  // Load DB rules (may be empty for a fresh org — fall back to defaultConfig)
  const { data: dbRules } = await supabase
    .from("decision_rules")
    .select("rule_type, enabled, config")
    .eq("organization_id", orgId);

  const dbRuleMap = new Map((dbRules ?? []).map((r) => [r.rule_type, r]));

  let allAlerts: Alert[] = [];
  const byRule: Record<string, number> = {};

  for (const rule of registeredRules) {
    const dbRule = dbRuleMap.get(rule.rule_type);

    // If explicitly disabled in DB, skip
    if (dbRule && !dbRule.enabled) continue;

    // Use DB config if available, otherwise fall back to rule's defaultConfig
    const config = dbRule
      ? (dbRule.config as Record<string, unknown>)
      : rule.defaultConfig;

    try {
      const alerts = await rule.evaluate(orgId, config);
      byRule[rule.rule_type] = alerts.length;
      allAlerts = allAlerts.concat(alerts);
    } catch (err) {
      console.error(`[engine] rule ${rule.rule_type} failed:`, err);
      byRule[rule.rule_type] = 0;
    }
  }

  let newCount = 0;

  for (const alert of allAlerts) {
    const isNew = await upsertAlert(supabase, orgId, alert);
    if (isNew) newCount++;
  }

  return { newAlerts: newCount, total: allAlerts.length, byRule };
}

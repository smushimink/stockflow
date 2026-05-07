import { createAdminClient } from "@/lib/supabase/admin";
import { deadStockRule } from "@/lib/decisions/rules/dead-stock";
import { reorderRule } from "@/lib/decisions/rules/reorder";
import { abcRule } from "@/lib/decisions/rules/abc";
import { marginRule } from "@/lib/decisions/rules/margin";
import { churnRule } from "@/lib/decisions/rules/churn";
import { supplierScorecardRule } from "@/lib/decisions/rules/supplier-score";
import { ecommercePipelineRule } from "@/lib/decisions/rules/ecommerce-pipeline";
import { seasonalForecastRule } from "@/lib/decisions/rules/seasonal-forecast";
import { customerProfitabilityRule } from "@/lib/decisions/rules/customer-profitability";
import { elasticityPricingRule } from "@/lib/decisions/rules/elasticity-pricing";
import type { Alert, BusinessContext, MarketSignal, DecisionRule } from "@/lib/decisions/types";
import { DEFAULT_BUSINESS_CONTEXT } from "@/lib/decisions/types";

const registeredRules: DecisionRule[] = [
  reorderRule,
  deadStockRule,
  abcRule,
  marginRule,
  churnRule,
  supplierScorecardRule,
  ecommercePipelineRule,
  seasonalForecastRule,
  customerProfitabilityRule,
  elasticityPricingRule,
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

async function loadOrgContext(orgId: string, supabase: ReturnType<typeof createAdminClient>) {
  const { data: org } = await supabase
    .from("organizations")
    .select("business_context")
    .eq("id", orgId)
    .single();

  const businessContext: BusinessContext = {
    ...DEFAULT_BUSINESS_CONTEXT,
    ...((org?.business_context as Partial<BusinessContext>) ?? {}),
  };

  const today = new Date().toISOString().split("T")[0];
  const { data: marketSignalsRows } = await supabase
    .from("market_signals")
    .select("id, signal_type, source, value, effective_from, effective_until, notes, created_at")
    .eq("organization_id", orgId)
    .or(`effective_until.is.null,effective_until.gte.${today}`);

  const marketSignals: MarketSignal[] = (marketSignalsRows ?? []) as MarketSignal[];
  return { businessContext, marketSignals };
}

// Run a single rule and upsert its alerts. Returns alert counts.
export async function runSingleRule(
  orgId: string,
  ruleType: string,
  configOverride?: Record<string, unknown>
): Promise<{ total: number; newAlerts: number }> {
  const supabase = createAdminClient();
  const rule = registeredRules.find((r) => r.rule_type === ruleType);
  if (!rule) return { total: 0, newAlerts: 0 };

  const { data: dbRule } = await supabase
    .from("decision_rules")
    .select("enabled, config")
    .eq("organization_id", orgId)
    .eq("rule_type", ruleType)
    .maybeSingle();

  if (dbRule && !dbRule.enabled && !configOverride) return { total: 0, newAlerts: 0 };

  const config = configOverride ?? (dbRule ? (dbRule.config as Record<string, unknown>) : rule.defaultConfig);
  const { businessContext, marketSignals } = await loadOrgContext(orgId, supabase);

  const alerts = await rule.evaluate({ orgId, config, businessContext, marketSignals });

  let newAlerts = 0;
  for (const alert of alerts) {
    const isNew = await upsertAlert(supabase, orgId, alert);
    if (isNew) newAlerts++;
  }
  return { total: alerts.length, newAlerts };
}

// Dry-run a single rule with an optional config override — does NOT persist alerts.
export async function runSingleRuleDryRun(
  orgId: string,
  ruleType: string,
  configOverride?: Record<string, unknown>
): Promise<{ total: number }> {
  const supabase = createAdminClient();
  const rule = registeredRules.find((r) => r.rule_type === ruleType);
  if (!rule) return { total: 0 };

  const { data: dbRule } = await supabase
    .from("decision_rules")
    .select("config")
    .eq("organization_id", orgId)
    .eq("rule_type", ruleType)
    .maybeSingle();

  const config = configOverride ?? (dbRule ? (dbRule.config as Record<string, unknown>) : rule.defaultConfig);
  const { businessContext, marketSignals } = await loadOrgContext(orgId, supabase);

  try {
    const alerts = await rule.evaluate({ orgId, config, businessContext, marketSignals });
    return { total: alerts.length };
  } catch {
    return { total: 0 };
  }
}

export async function runEngine(orgId: string): Promise<{
  newAlerts: number;
  total: number;
  byRule: Record<string, number>;
}> {
  const supabase = createAdminClient();
  const { businessContext, marketSignals } = await loadOrgContext(orgId, supabase);

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
      const alerts = await rule.evaluate({ orgId, config, businessContext, marketSignals });
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

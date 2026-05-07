"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runSingleRule, runSingleRuleDryRun } from "@/lib/decisions/engine";

async function getOrgAndUser(): Promise<{ orgId: string; userId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return null;
  return { orgId: membership.organization_id as string, userId: user.id };
}

// Ensure a decision_rules row exists for this org+ruleType (first use creates it from defaults)
async function ensureRule(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  ruleType: string
): Promise<{ id: string; config: Record<string, unknown> }> {
  const { data: existing } = await admin
    .from("decision_rules")
    .select("id, config")
    .eq("organization_id", orgId)
    .eq("rule_type", ruleType)
    .maybeSingle();

  if (existing) return { id: existing.id as string, config: existing.config as Record<string, unknown> };

  // Create with defaults
  const { data: inserted } = await admin
    .from("decision_rules")
    .insert({
      organization_id: orgId,
      rule_type: ruleType,
      name: ruleType,
      enabled: true,
      config: {},
    })
    .select("id, config")
    .single();

  return { id: inserted!.id as string, config: {} };
}

// ── Update a single threshold value ──────────────────────────────────────────

export async function updateThreshold(
  ruleType: string,
  configKey: string,
  newValue: number
): Promise<{ error?: string; total?: number; newAlerts?: number }> {
  const ctx = await getOrgAndUser();
  if (!ctx) return { error: "Not authenticated" };
  const { orgId, userId } = ctx;

  const admin = createAdminClient();
  const { id: ruleId, config: oldConfig } = await ensureRule(admin, orgId, ruleType);

  const oldValue = (oldConfig[configKey] as number | undefined) ?? null;
  const newConfig = { ...oldConfig, [configKey]: newValue };

  const { error } = await admin
    .from("decision_rules")
    .update({ config: newConfig })
    .eq("id", ruleId);

  if (error) return { error: error.message };

  // Audit log
  await admin.from("data_provenance").insert({
    organization_id: orgId,
    table_name: "decision_rules",
    record_id: ruleId,
    field_name: `config.${configKey}`,
    old_value: oldValue !== null ? String(oldValue) : null,
    new_value: String(newValue),
    source: "manual",
    changed_by: userId,
  });

  // Re-evaluate this rule
  const result = await runSingleRule(orgId, ruleType);

  revalidatePath("/today");
  revalidatePath("/rules");

  return { total: result.total, newAlerts: result.newAlerts };
}

// ── Dry-run preview (no DB writes) ────────────────────────────────────────────

export async function previewThreshold(
  ruleType: string,
  configOverride: Record<string, unknown>
): Promise<{ error?: string; total?: number }> {
  const ctx = await getOrgAndUser();
  if (!ctx) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { config: baseConfig } = await ensureRule(admin, ctx.orgId, ruleType);

  const merged = { ...baseConfig, ...configOverride };
  const result = await runSingleRuleDryRun(ctx.orgId, ruleType, merged);

  return { total: result.total };
}

// ── Load rule threshold history ───────────────────────────────────────────────

export interface ThresholdChange {
  id: string;
  configKey: string;
  oldValue: string | null;
  newValue: string;
  changedAt: string;
  changedBy: string | null;
}

export async function getThresholdHistory(ruleType: string): Promise<ThresholdChange[]> {
  const ctx = await getOrgAndUser();
  if (!ctx) return [];

  const admin = createAdminClient();
  const { id: ruleId } = await ensureRule(admin, ctx.orgId, ruleType);

  const { data } = await admin
    .from("data_provenance")
    .select("id, field_name, old_value, new_value, changed_at, changed_by")
    .eq("table_name", "decision_rules")
    .eq("record_id", ruleId)
    .order("changed_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    configKey: (r.field_name as string).replace("config.", ""),
    oldValue: r.old_value as string | null,
    newValue: r.new_value as string,
    changedAt: r.changed_at as string,
    changedBy: r.changed_by as string | null,
  }));
}

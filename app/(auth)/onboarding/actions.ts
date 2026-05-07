"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BusinessContext } from "@/lib/decisions/types";

export async function createOrganization(name: string): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name, slug, plan: "starter" })
    .select()
    .single();

  if (orgError) {
    return { error: orgError.message };
  }

  const { error: memberError } = await admin
    .from("memberships")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" });

  if (memberError) {
    return { error: memberError.message };
  }

  await admin.rpc("seed_default_rules", { p_org_id: org.id });

  return { orgId: org.id };
}

export async function saveOnboardingBusinessContext(
  orgId: string,
  context: Partial<BusinessContext>
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Verify user owns this org
  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .single();

  if (!membership) return { error: "Access denied" };

  // Merge with existing context
  const { data: org } = await admin
    .from("organizations")
    .select("business_context")
    .eq("id", orgId)
    .single();

  const merged = { ...(org?.business_context ?? {}), ...context };

  const { error } = await admin
    .from("organizations")
    .update({ business_context: merged })
    .eq("id", orgId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveRulePreferences(
  orgId: string,
  enabledRuleTypes: string[]
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", orgId)
    .single();

  if (!membership) return { error: "Access denied" };

  const { data: rules } = await admin
    .from("decision_rules")
    .select("rule_type")
    .eq("organization_id", orgId);

  if (!rules) return { success: true };

  for (const rule of rules) {
    await admin
      .from("decision_rules")
      .update({ enabled: enabledRuleTypes.includes(rule.rule_type as string) })
      .eq("organization_id", orgId)
      .eq("rule_type", rule.rule_type as string);
  }

  return { success: true };
}

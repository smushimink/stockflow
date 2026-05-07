"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detectSeasonality, type SeasonalityDetectionResult } from "@/lib/analytics/seasonality";

async function getOrgId(): Promise<string | null> {
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

  return (membership?.organization_id as string | null) ?? null;
}

export async function runSeasonalityDetection(): Promise<
  SeasonalityDetectionResult | { error: string }
> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  try {
    const result = await detectSeasonality(orgId);
    revalidatePath("/insights/seasonality");
    return result;
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function setPatternConfirmed(
  patternId: string,
  confirmed: boolean
): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("seasonality_patterns")
    .update({ manually_confirmed: confirmed })
    .eq("id", patternId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/insights/seasonality");
  return {};
}

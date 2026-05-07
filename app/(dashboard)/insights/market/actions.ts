"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

// ── FX rate ───────────────────────────────────────────────────────────────────

export async function upsertFxRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  priorRate: number
): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Delete any existing active signal for this pair (replace with the new one)
  await admin
    .from("market_signals")
    .delete()
    .eq("organization_id", orgId)
    .eq("signal_type", "fx_rate")
    .is("effective_until", null)
    .filter("value->from_currency", "eq", `"${fromCurrency}"`)
    .filter("value->to_currency", "eq", `"${toCurrency}"`);

  const { error } = await admin.from("market_signals").insert({
    organization_id: orgId,
    signal_type: "fx_rate",
    source: "manual",
    value: { from_currency: fromCurrency, to_currency: toCurrency, rate, prior_rate: priorRate },
    effective_from: today,
  });

  if (error) return { error: error.message };
  revalidatePath("/insights/market");
  return {};
}

// ── Category trend ────────────────────────────────────────────────────────────

export async function upsertCategoryTrend(
  category: string,
  trend: "rising" | "stable" | "declining"
): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  await admin
    .from("market_signals")
    .delete()
    .eq("organization_id", orgId)
    .eq("signal_type", "category_trend")
    .is("effective_until", null)
    .filter("value->category", "eq", `"${category}"`);

  const { error } = await admin.from("market_signals").insert({
    organization_id: orgId,
    signal_type: "category_trend",
    source: "manual",
    value: { category, trend },
    effective_from: today,
  });

  if (error) return { error: error.message };
  revalidatePath("/insights/market");
  return {};
}

// ── Manual note ───────────────────────────────────────────────────────────────

export async function addManualNote(
  text: string,
  tags: string[],
  effectiveFrom: string
): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  if (!text.trim()) return { error: "Note text is required" };

  const admin = createAdminClient();
  const { error } = await admin.from("market_signals").insert({
    organization_id: orgId,
    signal_type: "manual_note",
    source: "manual",
    value: { tags, text: text.trim() },
    effective_from: effectiveFrom,
  });

  if (error) return { error: error.message };
  revalidatePath("/insights/market");
  return {};
}

// ── Delete any signal ─────────────────────────────────────────────────────────

export async function deleteSignal(id: string): Promise<{ error?: string }> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("market_signals")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/insights/market");
  return {};
}

"use server";

import { createClient } from "@/lib/supabase/server";
import {
  recalculateAllMetrics,
  recalculateAbcClassification,
  recalculateCustomerMetrics,
} from "@/lib/metrics/calculator";

export type RecalculateResult =
  | {
      products_updated: number;
      abc_updated: number;
      customers_updated: number;
      duration_ms: number;
    }
  | { error: string };

export async function recalculateMetrics(): Promise<RecalculateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return { error: "No organization found" };

  const orgId = membership.organization_id;
  const start = Date.now();

  try {
    const products_updated = await recalculateAllMetrics(orgId);
    const abc_updated = await recalculateAbcClassification(orgId);
    const customers_updated = await recalculateCustomerMetrics(orgId);

    return {
      products_updated,
      abc_updated,
      customers_updated,
      duration_ms: Date.now() - start,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

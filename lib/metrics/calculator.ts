import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateAbcXyz } from "@/lib/analytics/abc-xyz";

export async function recalculateAllMetrics(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calculate_product_metrics", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function recalculateAbcClassification(orgId: string): Promise<number> {
  // Run the new ABC-XYZ classifier (supersedes the old SQL RPC)
  const results = await recalculateAbcXyz(orgId);
  return results.length;
}

export async function recalculateCustomerMetrics(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("recalculate_customer_metrics", {
    p_org_id: orgId,
  });
  if (error) throw error;

  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}

export async function recalculateSupplierMetrics(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("recalculate_supplier_metrics", {
    p_org_id: orgId,
  });
  if (error) throw error;

  const { count } = await supabase
    .from("suppliers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}

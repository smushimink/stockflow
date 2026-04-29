import { createAdminClient } from "@/lib/supabase/admin";

export async function recalculateAllMetrics(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("calculate_product_metrics", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function recalculateAbcClassification(orgId: string): Promise<number> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("recalculate_abc", { p_org_id: orgId });
  if (error) throw error;

  const { count } = await supabase
    .from("product_metrics")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("abc_class", "is", null);
  return count ?? 0;
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

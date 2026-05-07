import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  runSalesDriverRegression,
  runCustomerClvRegression,
  runLeadTimeModel,
} from "@/lib/analytics/regression-models";
import { RegressionClient } from "@/components/insights/regression-client";

export const dynamic = "force-dynamic";

export default async function RegressionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;
  const params = await searchParams;

  const periodDays = Math.min(365, Math.max(7, parseInt((params.period as string) ?? "90", 10)));
  const categoryFilter = (params.category as string) ?? "";

  const admin = createAdminClient();

  // Fetch active products for category filter options + product ID mapping
  const { data: products } = await admin
    .from("products")
    .select("id, category")
    .eq("organization_id", orgId)
    .eq("status", "active");

  const categories = [
    ...new Set(
      (products ?? []).map((p) => (p.category as string | null) ?? "Uncategorised")
    ),
  ].sort();

  // Resolve category filter → product IDs for sales model
  let productIds: string[] | undefined;
  if (categoryFilter && categoryFilter !== "all") {
    productIds = (products ?? [])
      .filter(
        (p) => ((p.category as string | null) ?? "Uncategorised") === categoryFilter
      )
      .map((p) => p.id as string);
    if (productIds.length === 0) productIds = undefined;
  }

  // Run all 3 models in parallel — each uses createAdminClient internally
  const [salesResult, clvResult, leadTimeResult] = await Promise.all([
    runSalesDriverRegression(orgId, productIds, periodDays),
    runCustomerClvRegression(orgId),
    runLeadTimeModel(orgId),
  ]);

  return (
    <RegressionClient
      salesResult={salesResult}
      clvResult={clvResult}
      leadTimeResult={leadTimeResult}
      periodDays={periodDays}
      categoryFilter={categoryFilter || "all"}
      categories={categories}
    />
  );
}

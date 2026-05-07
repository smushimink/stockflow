import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { InsightsTabs } from "@/components/insights/insights-tabs";
import { BundlesClient } from "@/components/insights/bundles-client";
import { findProductAssociations } from "@/lib/analytics/market-basket";

export const dynamic = "force-dynamic";

export default async function BundlesPage() {
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

  const result = await findProductAssociations(orgId, 0.02, 0.35);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-600 text-[#1A1A17]">Insights</h1>
        <p className="text-sm text-[#6B6B66] mt-0.5">Analytics across your inventory and sales.</p>
      </div>

      <InsightsTabs />

      <BundlesClient result={result} />
    </div>
  );
}

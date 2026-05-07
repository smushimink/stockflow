import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { calculateAllProductBreakEven } from "@/lib/analytics/break-even";
import { DEFAULT_BUSINESS_CONTEXT } from "@/lib/decisions/types";
import type { BusinessContext } from "@/lib/decisions/types";
import { BreakEvenClient } from "@/components/insights/break-even-client";

export const dynamic = "force-dynamic";

export default async function BreakEvenPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id as string;

  const { data: org } = await admin
    .from("organizations")
    .select("business_context")
    .eq("id", orgId)
    .single();

  const businessContext: BusinessContext = {
    ...DEFAULT_BUSINESS_CONTEXT,
    ...((org?.business_context as Partial<BusinessContext>) ?? {}),
  };

  const warehouseCost = businessContext.warehouse_cost_monthly;

  const results = await calculateAllProductBreakEven(orgId, warehouseCost);

  return (
    <BreakEvenClient
      results={results}
      warehouseCostMonthly={warehouseCost}
    />
  );
}

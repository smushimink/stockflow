import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RulesClient } from "@/components/rules/rules-client";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(plan)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const orgRaw = membership.organizations as { plan: string } | { plan: string }[] | null;
  const orgPlan = (Array.isArray(orgRaw) ? orgRaw[0]?.plan : orgRaw?.plan) ?? "starter";

  const { data: rules } = await supabase
    .from("decision_rules")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("rule_type");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-600 text-[#1A1A17]">Rules</h1>
        <p className="text-sm text-[#6B6B66] mt-1">
          Configure when StockFlow raises alerts and what thresholds to use.
        </p>
      </div>

      <RulesClient
        rules={rules ?? []}
        orgId={membership.organization_id}
        plan={orgPlan as import("@/lib/plans").PlanId}
      />
    </div>
  );
}

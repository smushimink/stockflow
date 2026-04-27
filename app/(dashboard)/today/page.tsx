import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SeverityGroup } from "@/components/today/severity-group";
import { firstOf } from "@/lib/utils";
import type { AlertWithProduct } from "@/lib/decisions/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgName = firstOf<{ name: string }>((membership as any).organizations)?.name ?? "Your workspace";

  const { data: alertsRaw } = await supabase
    .from("decision_alerts")
    .select(`
      id, rule_type, severity, status, title, summary, reasoning,
      suggested_action, suggested_value, suggested_qty, metadata,
      created_at, related_product_id,
      products (
        id, sku, name, selling_price, unit_cost, stock_on_hand, category,
        suppliers (name)
      )
    `)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  const alerts = (alertsRaw ?? []) as unknown as AlertWithProduct[];

  const red = alerts.filter((a) => a.severity === "red");
  const orange = alerts.filter((a) => a.severity === "orange");
  const yellow = alerts.filter((a) => a.severity === "yellow");

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-[#6B6B66] uppercase tracking-wider font-600">{today}</p>
        <h1 className="text-2xl font-600 text-[#1A1A17] mt-0.5">Today</h1>
        {alerts.length > 0 ? (
          <p className="text-sm text-[#6B6B66] mt-1">
            {alerts.length} action{alerts.length !== 1 ? "s" : ""} waiting for {orgName}
          </p>
        ) : (
          <p className="text-sm text-[#6B6B66] mt-1">Everything is looking good.</p>
        )}
      </div>

      {/* Alert groups */}
      {alerts.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[#F2F8F0] border border-[#4D7B3D]/20 flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9l4 4 8-8" stroke="#4D7B3D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-500 text-[#1A1A17]">No pending actions</p>
          <p className="text-xs text-[#6B6B66] mt-1">
            Alerts are generated nightly. Run the engine manually from the Rules page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <SeverityGroup
            title="Urgent"
            severity="red"
            alerts={red}
          />
          <SeverityGroup
            title="This week"
            severity="orange"
            alerts={orange}
          />
          <SeverityGroup
            title="Monitor"
            severity="yellow"
            alerts={yellow}
          />
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "active", "at_risk", "top_spenders"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Active",
  at_risk: "At risk",
  top_spenders: "Top spenders",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const activeFilter: Filter = (FILTERS as readonly string[]).includes(filterParam ?? "")
    ? (filterParam as Filter)
    : "all";

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

  const [{ data: customers }, { data: churnAlerts }] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("organization_id", orgId)
      .order("total_spent", { ascending: false }),
    supabase
      .from("decision_alerts")
      .select("related_customer_id")
      .eq("organization_id", orgId)
      .eq("rule_type", "customer_churn")
      .eq("status", "pending"),
  ]);

  const allCustomers = customers ?? [];
  const atRiskIds = new Set(
    (churnAlerts ?? []).map((a) => a.related_customer_id as string).filter(Boolean)
  );

  // Top spenders = top 25% by total_spent (only if any have spent > 0)
  const sorted = [...allCustomers].sort(
    (a, b) => (b.total_spent as number) - (a.total_spent as number)
  );
  const topCount = Math.max(1, Math.floor(sorted.length * 0.25));
  const topThreshold = (sorted[topCount - 1]?.total_spent as number) ?? 0;
  const topSpenderIds = new Set(
    topThreshold > 0
      ? allCustomers
          .filter((c) => (c.total_spent as number) >= topThreshold)
          .map((c) => c.id as string)
      : []
  );

  const counts: Record<Filter, number> = {
    all: allCustomers.length,
    active: allCustomers.filter((c) => c.active as boolean).length,
    at_risk: atRiskIds.size,
    top_spenders: topSpenderIds.size,
  };

  let displayed = allCustomers;
  if (activeFilter === "active") displayed = displayed.filter((c) => c.active as boolean);
  else if (activeFilter === "at_risk")
    displayed = displayed.filter((c) => atRiskIds.has(c.id as string));
  else if (activeFilter === "top_spenders")
    displayed = displayed.filter((c) => topSpenderIds.has(c.id as string));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-600 text-[#1A1A17]">Customers</h1>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/customers" : `/customers?filter=${f}`}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-500 px-3 py-1.5 rounded-lg border transition-colors",
              activeFilter === f
                ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#C8C8C4] hover:text-[#1A1A17]"
            )}
          >
            {FILTER_LABELS[f]}
            <span
              className={cn(
                "text-[10px] tabular-nums",
                activeFilter === f ? "text-white/60" : "text-[#C8C8C4]"
              )}
            >
              {counts[f]}
            </span>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Customer
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Orders
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Total spent
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Last order
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Risk
              </th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {displayed.map((c) => {
              const isAtRisk = atRiskIds.has(c.id as string);
              const hasData =
                (c.total_orders as number) >= 3 && c.avg_order_interval_days !== null;
              const risk = isAtRisk
                ? { dot: "bg-[#C54632]", title: "At risk of churn" }
                : hasData
                ? { dot: "bg-[#4D7B3D]", title: "Active" }
                : { dot: "bg-[#C8C8C4]", title: "Insufficient data" };

              return (
                <tr key={c.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-3">
                    <p className="font-500 text-[#1A1A17]">{c.name as string}</p>
                    {c.company && (
                      <p className="text-xs text-[#6B6B66]">{c.company as string}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">
                    {c.total_orders as number}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-500 text-[#1A1A17]">
                    {formatCurrency(c.total_spent as number)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#6B6B66]">
                    {c.last_order_at
                      ? new Date(c.last_order_at as string).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div
                      className={cn("w-2.5 h-2.5 rounded-full mx-auto", risk.dot)}
                      title={risk.title}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/customers/${c.id as string}`}
                      className="text-xs text-[#6B6B66] hover:text-[#1A1A17] underline-offset-2 hover:underline transition-colors"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B6B66]">
            No customers match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

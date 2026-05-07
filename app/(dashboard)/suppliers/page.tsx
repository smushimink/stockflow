import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["draft", "sent", "confirmed"];

export default async function SuppliersPage() {
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

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const [{ data: suppliers }, { data: pos }, { data: alerts }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("organization_id", orgId).order("name"),
    supabase
      .from("purchase_orders")
      .select("id, supplier_id, status, total, received_at")
      .eq("organization_id", orgId),
    supabase
      .from("decision_alerts")
      .select("related_supplier_id")
      .eq("organization_id", orgId)
      .eq("rule_type", "supplier_scorecard")
      .eq("status", "pending"),
  ]);

  const allPos = pos ?? [];
  const alertSuppliers = new Set((alerts ?? []).map((a) => a.related_supplier_id as string));

  // Per-supplier aggregates
  const activePosCount = new Map<string, number>();
  const spend90dMap = new Map<string, number>();
  const hasReceivedMap = new Map<string, boolean>();

  for (const po of allPos) {
    const sid = po.supplier_id as string | null;
    if (!sid) continue;

    if (ACTIVE_STATUSES.includes(po.status as string)) {
      activePosCount.set(sid, (activePosCount.get(sid) ?? 0) + 1);
    }

    if (po.status === "received") {
      hasReceivedMap.set(sid, true);
      if (po.received_at && po.received_at >= ninetyDaysAgo) {
        spend90dMap.set(sid, (spend90dMap.get(sid) ?? 0) + (po.total as number));
      }
    }
  }

  function scoreColor(supplierId: string): { dot: string; title: string } {
    if (alertSuppliers.has(supplierId))
      return { dot: "bg-[#B47214]", title: "Performance issue detected" };
    if (!hasReceivedMap.has(supplierId))
      return { dot: "bg-[#C8C8C4]", title: "No received orders yet" };
    return { dot: "bg-[#4D7B3D]", title: "No issues detected" };
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-600 text-[#1A1A17]">Suppliers</h1>
        <button className="text-sm font-500 bg-[#1A1A17] text-white px-4 py-2 rounded-lg hover:bg-[#2D2D29] transition-colors">
          Add supplier
        </button>
      </div>

      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Supplier
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Contact
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Lead time
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Active POs
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                90d spend
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Score
              </th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {(suppliers ?? []).map((s) => {
              const score = scoreColor(s.id as string);
              const activePOs = activePosCount.get(s.id as string) ?? 0;
              const spend90d = spend90dMap.get(s.id as string) ?? 0;
              return (
                <tr key={s.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-3">
                    <p className="font-500 text-[#1A1A17]">{s.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {s.code && (
                        <span className="text-xs text-[#6B6B66]">{s.code as string}</span>
                      )}
                      {!(s.active as boolean) && (
                        <span className="text-[10px] text-[#C54632] font-500 uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6B6B66]">
                    {s.contact_name && <p className="text-sm">{s.contact_name as string}</p>}
                    {s.contact_email && (
                      <p className="text-xs">{s.contact_email as string}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">
                    {s.lead_time_days as number}d
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={cn(
                        "font-500",
                        activePOs > 0 ? "text-[#1A1A17]" : "text-[#C8C8C4]"
                      )}
                    >
                      {activePOs > 0 ? activePOs : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">
                    {spend90d > 0 ? formatCurrency(spend90d) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div
                      className={cn("w-2.5 h-2.5 rounded-full mx-auto", score.dot)}
                      title={score.title}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/suppliers/${s.id as string}`}
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
        {!suppliers?.length && (
          <div className="py-12 text-center text-sm text-[#6B6B66]">No suppliers yet.</div>
        )}
      </div>
    </div>
  );
}

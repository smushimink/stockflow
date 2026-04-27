import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
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

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-600 text-[#1A1A17]">Purchases</h1>
        <button className="text-sm font-500 bg-[#1A1A17] text-white px-4 py-2 rounded-lg hover:bg-[#2D2D29] transition-colors">
          New order
        </button>
      </div>

      {!orders?.length ? (
        <div className="bg-white border border-[#E5E5E2] rounded-lg py-16 text-center">
          <p className="text-sm text-[#6B6B66]">No purchase orders yet.</p>
          <p className="text-xs text-[#6B6B66] mt-1">Create your first order when products need reordering.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Order</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Supplier</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-3 font-500 text-[#1A1A17]">{o.order_number}</td>
                  <td className="px-4 py-3 text-[#6B6B66]">{(o.suppliers as { name: string } | null)?.name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-[#6B6B66]">{o.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#1A1A17]">{formatCurrency(o.total)}</td>
                  <td className="px-4 py-3 text-[#6B6B66]">
                    {o.expected_at ? new Date(o.expected_at).toLocaleDateString("en-AU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

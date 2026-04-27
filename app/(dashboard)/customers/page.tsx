import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
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

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("total_spent", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-600 text-[#1A1A17]">Customers</h1>

      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Customer</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Orders</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Total spent</th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-[#F7F7F5]">
                <td className="px-4 py-3">
                  <p className="font-500 text-[#1A1A17]">{c.name}</p>
                  {c.company && <p className="text-xs text-[#6B6B66]">{c.company}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">{c.total_orders}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#1A1A17]">{formatCurrency(c.total_spent)}</td>
                <td className="px-4 py-3 text-[#6B6B66]">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-AU") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers?.length && (
          <div className="py-12 text-center text-sm text-[#6B6B66]">No customers yet.</div>
        )}
      </div>
    </div>
  );
}

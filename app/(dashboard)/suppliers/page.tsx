import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .eq("active", true)
    .order("name");

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Supplier</th>
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Contact</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Lead time</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">MOQ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {(suppliers ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-[#F7F7F5]">
                <td className="px-4 py-3">
                  <p className="font-500 text-[#1A1A17]">{s.name}</p>
                  {s.code && <p className="text-xs text-[#6B6B66]">{s.code}</p>}
                </td>
                <td className="px-4 py-3 text-[#6B6B66]">
                  {s.contact_name && <p>{s.contact_name}</p>}
                  {s.contact_email && <p className="text-xs">{s.contact_email}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">{s.lead_time_days}d</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">{s.moq}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!suppliers?.length && (
          <div className="py-12 text-center text-sm text-[#6B6B66]">No suppliers yet.</div>
        )}
      </div>
    </div>
  );
}

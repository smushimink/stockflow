import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConnectedList, AvailableGrid } from "./integrations-grid";

export const dynamic = "force-dynamic";

const AVAILABLE_INTEGRATIONS = [
  { id: "shopify", name: "Shopify", category: "E-commerce", comingSoon: false },
  { id: "xero", name: "Xero", category: "Accounting", comingSoon: false },
  { id: "myob", name: "MYOB", category: "Accounting", comingSoon: true },
  { id: "amazon", name: "Amazon", category: "Marketplace", comingSoon: true },
  { id: "ebay", name: "eBay", category: "Marketplace", comingSoon: true },
  { id: "square", name: "Square", category: "POS", comingSoon: true },
  { id: "lightspeed", name: "Lightspeed", category: "POS", comingSoon: true },
  { id: "zapier", name: "Zapier", category: "Automation", comingSoon: true },
];

export default async function IntegrationsPage() {
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

  const { data: connected } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", membership.organization_id);

  const connectedList = connected ?? [];
  const connectedIds = connectedList.map((c) => c.provider);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-600 text-[#1A1A17]">Integrations</h1>
        <p className="text-sm text-[#6B6B66] mt-1">Connect your data sources to keep StockFlow up to date.</p>
      </div>

      {/* CSV import CTA */}
      <Link
        href="/integrations/csv"
        className="flex items-center gap-4 bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 hover:border-[#C8C8C4] transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-[#F7F7F5] border border-[#E5E5E2] flex items-center justify-center text-lg shrink-0">
          📄
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-500 text-[#1A1A17]">CSV Import</p>
          <p className="text-xs text-[#6B6B66]">Upload a product spreadsheet with AI column mapping</p>
        </div>
        <span className="text-xs font-500 text-[#4D7B3D] bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded px-2 py-0.5 shrink-0">
          Ready
        </span>
      </Link>

      <ConnectedList connected={connectedList} />

      <AvailableGrid integrations={AVAILABLE_INTEGRATIONS} connectedIds={connectedIds} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/purchases/filter-chips";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft:     { label: "Draft",     dot: "bg-[#C8C8C4]", text: "text-[#6B6B66]",  bg: "bg-[#F7F7F5]" },
  sent:      { label: "Sent",      dot: "bg-[#3B6BB4]",  text: "text-[#3B6BB4]", bg: "bg-[#EEF3FB]" },
  confirmed: { label: "Confirmed", dot: "bg-[#B47214]",  text: "text-[#B47214]", bg: "bg-[#FDF8EE]" },
  received:  { label: "Received",  dot: "bg-[#4D7B3D]",  text: "text-[#4D7B3D]", bg: "bg-[#F2F8F0]" },
  cancelled: { label: "Cancelled", dot: "bg-[#C54632]",  text: "text-[#C54632]", bg: "bg-[#FDF2F0]" },
};

interface SearchParams {
  status?: string;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const statusFilter = params.status ?? "all";

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

  let query = supabase
    .from("purchase_orders")
    .select(`
      id, order_number, status, subtotal, shipping, total,
      expected_at, received_at, created_at,
      suppliers ( name ),
      purchase_order_items ( id )
    `)
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: orders } = await query;

  // Counts per status for chips (unfiltered)
  const { data: allOrders } = await supabase
    .from("purchase_orders")
    .select("id, status, total")
    .eq("organization_id", membership.organization_id);

  const countByStatus = (allOrders ?? []).reduce<Record<string, number>>((acc, o) => {
    const s = o.status as string;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const open = (allOrders ?? []).filter((o) => !["received", "cancelled"].includes(o.status as string)).length;
  const totalValue = (allOrders ?? [])
    .filter((o) => !["cancelled"].includes(o.status as string))
    .reduce((s, o) => s + (o.total as number), 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-600 text-[#1A1A17]">Purchase orders</h1>
          {(allOrders?.length ?? 0) > 0 && (
            <p className="text-sm text-[#6B6B66] mt-0.5">
              {open} open · {formatCurrency(totalValue)} total value
            </p>
          )}
        </div>
        <Link
          href="/purchases/new"
          className="text-sm font-500 bg-[#1A1A17] text-white px-4 py-2 rounded-lg hover:bg-[#2D2D29] transition-colors"
        >
          + New PO
        </Link>
      </div>

      {/* Filter chips */}
      <FilterChips current={statusFilter} counts={countByStatus} total={allOrders?.length ?? 0} />

      {/* Empty state */}
      {!(orders?.length) ? (
        <div className="bg-white border border-[#E5E5E2] rounded-lg py-16 text-center">
          <p className="text-sm font-500 text-[#1A1A17]">
            {statusFilter === "all" ? "No purchase orders yet" : `No ${statusFilter} orders`}
          </p>
          {statusFilter === "all" && (
            <>
              <p className="text-xs text-[#6B6B66] mt-1">
                Create your first order, or run the engine on the Rules page to generate reorder alerts.
              </p>
              <Link
                href="/purchases/new"
                className="inline-block mt-4 text-sm font-500 bg-[#1A1A17] text-white px-4 py-2 rounded-lg hover:bg-[#2D2D29] transition-colors"
              >
                + New PO
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Order #</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Supplier</th>
                <th className="text-center px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Items</th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Subtotal</th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Expected</th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {(orders ?? []).map((o) => {
                const sc = statusConfig[o.status as string] ?? statusConfig.draft;
                const supplierRaw = o.suppliers as { name: string } | { name: string }[] | null;
                const supplierName = Array.isArray(supplierRaw) ? supplierRaw[0]?.name : supplierRaw?.name;
                const itemCount = Array.isArray(o.purchase_order_items) ? o.purchase_order_items.length : 0;

                return (
                  <tr key={o.id as string} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-3">
                      <Link href={`/purchases/${o.id}`} className="font-500 text-[#1A1A17] hover:underline tabular-nums">
                        {o.order_number as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#6B6B66]">{supplierName ?? "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-[#6B6B66]">{itemCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">
                      {formatCurrency(o.subtotal as number)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-500 text-[#1A1A17]">
                      <Link href={`/purchases/${o.id}`}>{formatCurrency(o.total as number)}</Link>
                    </td>
                    <td className="px-4 py-3 text-[#6B6B66] text-xs">
                      {o.expected_at
                        ? new Date(o.expected_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-500 px-2 py-0.5 rounded-full", sc.bg, sc.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/purchases/${o.id}`}
                        className="text-xs text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

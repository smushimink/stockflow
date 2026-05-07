import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, firstOf } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SalesInsightsPage() {
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const thirtyDaysAgoDate = new Date(Date.now() - 30 * 86400000);

  const [{ data: orders90d }, { data: metrics }, { data: recentSalesItems }] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, total, ordered_at")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("ordered_at", ninetyDaysAgo),
    supabase
      .from("product_metrics")
      .select(`
        product_id, revenue_90d, units_sold_90d, avg_daily_sales_30d, real_margin_pct,
        products ( id, sku, name, selling_price, abc_class, category, created_at )
      `)
      .eq("organization_id", orgId),
    supabase
      .from("sales_orders")
      .select("ordered_at, sales_order_items ( product_id, sku, name, qty, total, unit_price, unit_cost )")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("ordered_at", ninetyDaysAgo),
  ]);

  // KPI calculations
  const rev90d = (orders90d ?? []).reduce((s, o) => s + (o.total as number), 0);
  const orders30d = (orders90d ?? []).filter((o) => new Date(o.ordered_at as string) >= thirtyDaysAgoDate);
  const rev30d = orders30d.reduce((s, o) => s + (o.total as number), 0);
  const count30d = orders30d.length;
  const avgOrder30d = count30d > 0 ? rev30d / count30d : 0;

  const hasMetrics = (metrics ?? []).length > 0;

  // ── Top sellers from product_metrics ─────────────────────────────────────────
  let bestByUnits: Array<{ id: string; sku: string; name: string; units: number; revenue: number; abcClass: string | null }> = [];
  let topByRevenue: Array<{ id: string; sku: string; name: string; revenue: number; units: number; abcClass: string | null }> = [];
  let worstPerformers: Array<{ id: string; sku: string; name: string; revenue: number; units: number }> = [];

  if (hasMetrics) {
    const metricsWithProduct = (metrics ?? []).filter((m) => m.revenue_90d != null);
    const productCreatedMap = new Map<string, Date>();

    const enriched = metricsWithProduct.map((m) => {
      const p = firstOf<{ id: string; sku: string; name: string; selling_price: number; abc_class: string | null; category: string | null; created_at: string }>(m.products as unknown);
      productCreatedMap.set(m.product_id as string, p ? new Date(p.created_at) : new Date(0));
      return {
        id: m.product_id as string,
        sku: p?.sku ?? "—",
        name: p?.name ?? "Unknown",
        units: m.units_sold_90d as number,
        revenue: m.revenue_90d as number,
        abcClass: (p?.abc_class as string | null) ?? null,
        createdAt: p ? new Date(p.created_at) : new Date(0),
      };
    });

    bestByUnits = [...enriched].sort((a, b) => b.units - a.units).slice(0, 10);
    topByRevenue = [...enriched].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Worst performers: active products older than 30 days with lowest revenue (>0 means active)
    const thirtyDaysAgoThreshold = thirtyDaysAgoDate;
    worstPerformers = enriched
      .filter((e) => e.createdAt < thirtyDaysAgoThreshold)
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 10)
      .map(({ id, sku, name, revenue, units }) => ({ id, sku, name, revenue, units }));
  } else {
    // Fallback: compute from sales_order_items
    const productRevMap = new Map<string, { sku: string; name: string; revenue: number; units: number }>();
    for (const order of recentSalesItems ?? []) {
      const items = Array.isArray(order.sales_order_items) ? order.sales_order_items : order.sales_order_items ? [order.sales_order_items] : [];
      for (const item of items) {
        const i = item as { product_id: string | null; sku: string; name: string; qty: number; total: number };
        const key = i.product_id ?? i.sku;
        const existing = productRevMap.get(key) ?? { sku: i.sku, name: i.name, revenue: 0, units: 0 };
        existing.revenue += i.total;
        existing.units += i.qty;
        productRevMap.set(key, existing);
      }
    }
    const all = [...productRevMap.entries()].map(([id, v]) => ({ id, ...v, abcClass: null }));
    bestByUnits = [...all].sort((a, b) => b.units - a.units).slice(0, 10);
    topByRevenue = [...all].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    worstPerformers = [...all].sort((a, b) => a.revenue - b.revenue).slice(0, 10).map(({ id, sku, name, revenue, units }) => ({ id, sku, name, revenue, units }));
  }

  // ── Sales by category ─────────────────────────────────────────────────────────
  // Build category revenue from sales_order_items + product categories
  const { data: allActiveProducts } = await supabase
    .from("products")
    .select("id, category")
    .eq("organization_id", orgId)
    .eq("status", "active");

  const productCategoryMap = new Map((allActiveProducts ?? []).map((p) => [p.id as string, (p.category as string | null) ?? "Uncategorised"]));

  const categoryRevMap = new Map<string, { revenue: number; units: number; cost: number }>();
  for (const order of recentSalesItems ?? []) {
    const items = Array.isArray(order.sales_order_items) ? order.sales_order_items : order.sales_order_items ? [order.sales_order_items] : [];
    for (const item of items) {
      const i = item as { product_id: string | null; qty: number; total: number; unit_cost: number };
      const cat = i.product_id ? (productCategoryMap.get(i.product_id) ?? "Uncategorised") : "Uncategorised";
      const existing = categoryRevMap.get(cat) ?? { revenue: 0, units: 0, cost: 0 };
      existing.revenue += i.total;
      existing.units += i.qty;
      existing.cost += i.unit_cost * i.qty;
      categoryRevMap.set(cat, existing);
    }
  }
  const categoryRows = [...categoryRevMap.entries()]
    .map(([cat, { revenue, units, cost }]) => ({
      cat,
      revenue,
      units,
      margin: revenue > 0 ? (revenue - cost) / revenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const abcColor: Record<string, string> = {
    A: "text-[#4D7B3D] font-600",
    B: "text-[#B47214] font-600",
    C: "text-[#6B6B66]",
  };

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Revenue (90d)" value={formatCurrency(rev90d)} />
        <StatCard label="Revenue (30d)" value={formatCurrency(rev30d)} />
        <StatCard label="Orders (30d)" value={count30d.toString()} />
        <StatCard label="Avg order value" value={formatCurrency(avgOrder30d)} />
      </div>

      {/* 3-column sellers */}
      <div className="grid grid-cols-3 gap-4">
        {/* Best sellers by units */}
        <SellerTable
          title="Best sellers — units"
          rows={bestByUnits.map((s) => ({ id: s.id, sku: s.sku, name: s.name, metricLabel: "units", metricValue: s.units.toLocaleString(), abcClass: s.abcClass ?? null }))}
        />

        {/* Top by revenue */}
        <SellerTable
          title="Top revenue — 90d"
          rows={topByRevenue.map((s) => ({ id: s.id, sku: s.sku, name: s.name, metricLabel: "revenue", metricValue: formatCurrency(s.revenue), abcClass: s.abcClass ?? null }))}
        />

        {/* Worst performers */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2] flex items-center justify-between">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Worst performers</p>
            {!hasMetrics && <p className="text-[10px] text-[#6B6B66]">Estimated</p>}
          </div>
          {worstPerformers.length === 0 ? (
            <div className="px-4 py-6 text-xs text-center text-[#6B6B66]">No data</div>
          ) : (
            <div className="divide-y divide-[#E5E5E2]">
              {worstPerformers.map((s, idx) => (
                <div key={s.id} className="px-4 py-2 flex items-center gap-2 hover:bg-[#F7F7F5]">
                  <span className="text-[10px] text-[#C8C8C4] w-4 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-500 text-[#1A1A17] truncate">{s.sku}</p>
                    <p className="text-[11px] text-[#6B6B66] truncate">{s.name}</p>
                  </div>
                  <span className="text-xs tabular-nums text-[#C54632] shrink-0">{formatCurrency(s.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sales by category */}
      {categoryRows.length > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Sales by category — last 90 days
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Category</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Units</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Revenue</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Est. margin</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">% of total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {categoryRows.map((row) => (
                <tr key={row.cat} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5 text-[#1A1A17] font-500">{row.cat}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">{row.units.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">{formatCurrency(row.revenue)}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums text-xs",
                    row.margin >= 0.3 ? "text-[#4D7B3D]" : row.margin >= 0.15 ? "text-[#B47214]" : "text-[#C54632]"
                  )}>
                    {(row.margin * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                    {rev90d > 0 ? ((row.revenue / rev90d) * 100).toFixed(1) : "0"}%
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

function SellerTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; sku: string; name: string; metricLabel: string; metricValue: string; abcClass: string | null }>;
}) {
  const abcColor: Record<string, string> = {
    A: "text-[#4D7B3D] font-600",
    B: "text-[#B47214] font-600",
    C: "text-[#6B6B66]",
  };

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E5E2]">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">{title}</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-xs text-center text-[#6B6B66]">No data</div>
      ) : (
        <div className="divide-y divide-[#E5E5E2]">
          {rows.map((row, idx) => (
            <div key={row.id} className="px-4 py-2 flex items-center gap-2 hover:bg-[#F7F7F5]">
              <span className="text-[10px] text-[#C8C8C4] w-4 shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-500 text-[#1A1A17] truncate flex items-center gap-1.5">
                  {row.sku}
                  {row.abcClass && (
                    <span className={cn("text-[10px]", abcColor[row.abcClass])}>{row.abcClass}</span>
                  )}
                </p>
                <p className="text-[11px] text-[#6B6B66] truncate">{row.name}</p>
              </div>
              <span className="text-xs tabular-nums font-500 text-[#1A1A17] shrink-0">{row.metricValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
      <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-600 tabular-nums mt-2 text-[#1A1A17]">{value}</p>
    </div>
  );
}

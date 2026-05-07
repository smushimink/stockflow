import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const abcColor: Record<string, string> = {
  A: "text-[#4D7B3D] font-600",
  B: "text-[#B47214] font-600",
  C: "text-[#6B6B66]",
};

export default async function InventoryInsightsPage() {
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

  const [{ data: products }, { data: metrics }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, category, stock_on_hand, reorder_point, unit_cost, selling_price, abc_class, supplier_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("product_metrics")
      .select("product_id, days_of_cover, cash_tied_up, days_since_last_sale, avg_daily_sales_30d")
      .eq("organization_id", orgId),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("active", true),
  ]);

  const metricsMap = new Map((metrics ?? []).map((m) => [m.product_id as string, m]));
  const supplierNameMap = new Map((suppliers ?? []).map((s) => [s.id as string, s.name as string]));
  const allProducts = products ?? [];

  // ── KPI stats ────────────────────────────────────────────────────────────────
  const totalValue = allProducts.reduce((s, p) => s + (p.stock_on_hand as number) * (p.unit_cost as number), 0);
  const belowReorder = allProducts.filter((p) => (p.stock_on_hand as number) <= (p.reorder_point as number)).length;
  const hasMetrics = (metrics ?? []).length > 0;

  const stockoutRisk = hasMetrics
    ? allProducts.filter((p) => {
        const m = metricsMap.get(p.id as string);
        if (!m) return false;
        const daysOfCover = m.days_of_cover as number;
        const product = p as { lead_time_days?: number | null };
        const leadTime = product.lead_time_days ?? 14;
        return daysOfCover < leadTime && (p.stock_on_hand as number) > 0;
      }).length
    : belowReorder;

  const deadStockCash = hasMetrics
    ? (metrics ?? [])
        .filter((m) => (m.days_since_last_sale as number | null) != null && (m.days_since_last_sale as number) > 90)
        .reduce((s, m) => s + (m.cash_tied_up as number), 0)
    : 0;

  // ── Category distribution ────────────────────────────────────────────────────
  const categoryMap = new Map<string, { skus: number; value: number }>();
  for (const p of allProducts) {
    const cat = (p.category as string | null) ?? "Uncategorised";
    const val = (p.stock_on_hand as number) * (p.unit_cost as number);
    const existing = categoryMap.get(cat) ?? { skus: 0, value: 0 };
    categoryMap.set(cat, { skus: existing.skus + 1, value: existing.value + val });
  }
  const categories = [...categoryMap.entries()]
    .sort((a, b) => b[1].value - a[1].value);

  // ── Supplier distribution ─────────────────────────────────────────────────────
  const supplierMap = new Map<string, { name: string; skus: number; value: number }>();
  for (const p of allProducts) {
    const sid = (p.supplier_id as string | null) ?? "__none__";
    const name = sid === "__none__" ? "No supplier" : (supplierNameMap.get(sid) ?? "Unknown");
    const val = (p.stock_on_hand as number) * (p.unit_cost as number);
    const existing = supplierMap.get(sid) ?? { name, skus: 0, value: 0 };
    supplierMap.set(sid, { name, skus: existing.skus + 1, value: existing.value + val });
  }
  const supplierRows = [...supplierMap.values()].sort((a, b) => b.value - a.value);

  // ── Top 10 by value / Bottom 10 by velocity ──────────────────────────────────
  const sorted = [...allProducts].sort(
    (a, b) => (b.stock_on_hand as number) * (b.unit_cost as number) - (a.stock_on_hand as number) * (a.unit_cost as number)
  );
  const top10ByValue = sorted.slice(0, 10);

  const bottom10ByVelocity = hasMetrics
    ? [...allProducts]
        .filter((p) => {
          const m = metricsMap.get(p.id as string);
          return m && (m.avg_daily_sales_30d as number) > 0;
        })
        .sort((a, b) => {
          const aVel = (metricsMap.get(a.id as string)?.avg_daily_sales_30d as number) ?? 0;
          const bVel = (metricsMap.get(b.id as string)?.avg_daily_sales_30d as number) ?? 0;
          return aVel - bVel;
        })
        .slice(0, 10)
    : [];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Inventory value" value={formatCurrency(totalValue)} />
        <StatCard label="Active SKUs" value={allProducts.length.toString()} />
        <StatCard
          label="Stockout risk"
          value={stockoutRisk.toString()}
          sub={hasMetrics ? "days cover < lead time" : "≤ reorder point"}
          accent={stockoutRisk > 0 ? "red" : undefined}
        />
        <StatCard
          label="Cash in dead stock"
          value={hasMetrics ? formatCurrency(deadStockCash) : "—"}
          sub={!hasMetrics ? "Run engine to compute" : deadStockCash > 0 ? "> 90 days idle" : undefined}
          accent={deadStockCash > 0 ? "orange" : undefined}
        />
      </div>

      {/* Middle: category + supplier distribution */}
      <div className="grid grid-cols-2 gap-4">
        {/* Category distribution */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">By category</p>
          </div>
          {categories.length === 0 ? (
            <div className="px-4 py-6 text-xs text-[#6B6B66] text-center">No category data</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKUs</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Value</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {categories.map(([cat, { skus, value }]) => (
                  <tr key={cat} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-2 text-[#1A1A17]">{cat}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#6B6B66]">{skus}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-500 text-[#1A1A17]">{formatCurrency(value)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#6B6B66]">
                      {totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Supplier distribution */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">By supplier</p>
          </div>
          {supplierRows.length === 0 ? (
            <div className="px-4 py-6 text-xs text-[#6B6B66] text-center">No supplier data</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Supplier</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKUs</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Value</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {supplierRows.map((row) => (
                  <tr key={row.name} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-2 text-[#1A1A17]">{row.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#6B6B66]">{row.skus}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-500 text-[#1A1A17]">{formatCurrency(row.value)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-[#6B6B66]">
                      {totalValue > 0 ? ((row.value / totalValue) * 100).toFixed(1) : "0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom: top 10 value + bottom 10 velocity */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top 10 by value */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Top 10 — cash tied up</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
                <th className="text-center px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">ABC</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {top10ByValue.map((p) => {
                const value = (p.stock_on_hand as number) * (p.unit_cost as number);
                const abc = (p.abc_class as string | null);
                return (
                  <tr key={p.id as string} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-2 text-xs font-500 text-[#1A1A17] tabular-nums">{p.sku as string}</td>
                    <td className="px-4 py-2 text-[#6B6B66] text-xs truncate max-w-[120px]">{p.name as string}</td>
                    <td className={cn("px-4 py-2 text-center text-xs", abc ? abcColor[abc] : "text-[#C8C8C4]")}>{abc ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-500 text-[#1A1A17]">{formatCurrency(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom 10 by velocity */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Bottom 10 — lowest velocity</p>
          </div>
          {bottom10ByVelocity.length === 0 ? (
            <div className="px-4 py-8 text-xs text-[#6B6B66] text-center">
              Run the engine to compute velocity metrics
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Daily avg</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {bottom10ByVelocity.map((p) => {
                  const m = metricsMap.get(p.id as string);
                  const vel = m ? (m.avg_daily_sales_30d as number) : 0;
                  return (
                    <tr key={p.id as string} className="hover:bg-[#F7F7F5]">
                      <td className="px-4 py-2 text-xs font-500 text-[#1A1A17] tabular-nums">{p.sku as string}</td>
                      <td className="px-4 py-2 text-[#6B6B66] text-xs truncate max-w-[120px]">{p.name as string}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#B47214]">{vel.toFixed(2)}/d</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#1A1A17] font-500">{p.stock_on_hand as number}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: "red" | "orange" | "green";
}) {
  const accentColor = { red: "text-[#C54632]", orange: "text-[#B47214]", green: "text-[#4D7B3D]" };
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
      <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-600 tabular-nums mt-2", accent ? accentColor[accent] : "text-[#1A1A17]")}>{value}</p>
      {sub && <p className="text-xs text-[#6B6B66] mt-0.5">{sub}</p>}
    </div>
  );
}

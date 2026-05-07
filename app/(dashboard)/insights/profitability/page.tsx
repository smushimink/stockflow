import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatPercent } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
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

  const [
    { data: topProductsRaw },
    { data: topCustomers },
    { data: suppliers },
    { data: lowMarginRaw },
    { data: allMetrics },
  ] = await Promise.all([
    // Top 10 products by gross_profit_90d
    supabase
      .from("product_metrics")
      .select(
        `product_id, gross_profit_90d, gross_margin_pct, revenue_90d,
         products ( id, sku, name )`
      )
      .eq("organization_id", orgId)
      .gt("gross_profit_90d", 0)
      .order("gross_profit_90d", { ascending: false })
      .limit(10),
    // Top 10 customers by gross_profit_90d
    supabase
      .from("customers")
      .select("id, name, gross_profit_90d, gross_profit_lifetime, avg_margin_pct, total_spent")
      .eq("organization_id", orgId)
      .gt("gross_profit_90d", 0)
      .order("gross_profit_90d", { ascending: false })
      .limit(10),
    // Suppliers with avg_margin_on_supplied
    supabase
      .from("suppliers")
      .select("id, name, avg_margin_on_supplied, products_supplied, total_purchases_90d")
      .eq("organization_id", orgId)
      .eq("active", true)
      .not("avg_margin_on_supplied", "is", null)
      .order("avg_margin_on_supplied", { ascending: false }),
    // Low margin products (< 15%)
    supabase
      .from("product_metrics")
      .select(
        `product_id, gross_margin_pct, revenue_90d,
         products ( id, sku, name, selling_price, unit_cost )`
      )
      .eq("organization_id", orgId)
      .lt("gross_margin_pct", 0.15)
      .gt("revenue_90d", 0)
      .order("revenue_90d", { ascending: false })
      .limit(20),
    // All metrics for totals
    supabase
      .from("product_metrics")
      .select("gross_profit_90d, revenue_90d")
      .eq("organization_id", orgId),
  ]);

  const allMetricsList = allMetrics ?? [];
  const totalProfit90d = allMetricsList.reduce((s, m) => s + (m.gross_profit_90d as number), 0);
  const totalRevenue90d = allMetricsList.reduce((s, m) => s + (m.revenue_90d as number), 0);
  const avgMargin = totalRevenue90d > 0 ? totalProfit90d / totalRevenue90d : 0;

  // Top product pareto
  const topProducts = (topProductsRaw ?? []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prod = Array.isArray(m.products) ? (m.products as any[])[0] : m.products;
    return {
      id: prod?.id as string,
      sku: prod?.sku as string,
      name: prod?.name as string,
      profit: m.gross_profit_90d as number,
      margin: m.gross_margin_pct as number,
      revenue: m.revenue_90d as number,
    };
  });

  const topProductsProfit = topProducts.reduce((s, p) => s + p.profit, 0);
  const topProductsPct = totalProfit90d > 0 ? (topProductsProfit / totalProfit90d) * 100 : 0;

  // Top customer pareto
  const customerList = (topCustomers ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    profit90d: c.gross_profit_90d as number,
    profitLife: c.gross_profit_lifetime as number,
    margin: (c.avg_margin_pct as number) ?? 0,
    spent: c.total_spent as number,
  }));
  const topCustomersProfit = customerList.reduce((s, c) => s + c.profit90d, 0);
  const totalCustomerProfit90d = (topCustomers ?? []).reduce(
    (s, c) => s + (c.gross_profit_90d as number),
    0
  );
  const topCustomersPct =
    totalCustomerProfit90d > 0 ? (topCustomersProfit / totalCustomerProfit90d) * 100 : 0;

  // Low margin products
  const lowMargin = (lowMarginRaw ?? []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prod = Array.isArray(m.products) ? (m.products as any[])[0] : m.products;
    const cost = prod?.unit_cost as number;
    const suggestedPrice = cost > 0 ? cost / (1 - 0.25) : 0;
    return {
      id: prod?.id as string,
      sku: prod?.sku as string,
      name: prod?.name as string,
      sellingPrice: prod?.selling_price as number,
      cost,
      margin: m.gross_margin_pct as number,
      revenue: m.revenue_90d as number,
      suggestedPrice,
    };
  });

  return (
    <div className="space-y-6">
      {/* ── Hero metrics ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1A1A17] rounded-lg px-4 py-3 col-span-1">
          <p className="text-xs text-[#9B9B97]">Gross profit (90d)</p>
          <p className="text-2xl font-600 tabular-nums text-white mt-0.5">
            {formatCurrency(totalProfit90d)}
          </p>
        </div>
        <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3">
          <p className="text-xs text-[#6B6B66]">Avg gross margin</p>
          <p className="text-2xl font-600 tabular-nums text-[#1A1A17] mt-0.5">
            {formatPercent(avgMargin)}
          </p>
          <p className="text-xs text-[#6B6B66]">on {formatCurrency(totalRevenue90d)} revenue</p>
        </div>
        <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3">
          <p className="text-xs text-[#6B6B66]">Profit from top 10 SKUs</p>
          <p className="text-2xl font-600 tabular-nums text-[#1A1A17] mt-0.5">
            {topProductsPct.toFixed(0)}%
          </p>
          <p className="text-xs text-[#6B6B66]">{formatCurrency(topProductsProfit)} of all profit</p>
        </div>
      </div>

      {/* ── Profit mix ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* By product */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Profit by product
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">SKU</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Profit</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {topProducts.map((p, i) => (
                <tr key={p.sku} className="hover:bg-[#F7F7F5]">
                  <td className="px-3 py-2">
                    <span className="text-[#C8C8C4] mr-1 tabular-nums">{i + 1}.</span>
                    {p.id ? (
                      <Link href={`/products/${p.id}`} className="font-500 text-[#1A1A17] hover:underline">
                        {p.sku}
                      </Link>
                    ) : (
                      <span className="font-500 text-[#1A1A17]">{p.sku}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-500 text-[#1A1A17]">
                    {formatCurrency(p.profit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#6B6B66]">
                    {formatPercent(p.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalProfit90d > 0 && (
            <div className="px-4 py-2.5 border-t border-[#E5E5E2] bg-[#F7F7F5]">
              <p className="text-xs text-[#6B6B66]">
                These {topProducts.length} SKUs generate{" "}
                <strong>{topProductsPct.toFixed(0)}%</strong> of all profit.
              </p>
            </div>
          )}
        </div>

        {/* By customer */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Profit by customer
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Customer</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Profit</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {customerList.map((c, i) => (
                <tr key={c.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-3 py-2">
                    <span className="text-[#C8C8C4] mr-1 tabular-nums">{i + 1}.</span>
                    <Link href={`/customers/${c.id}`} className="font-500 text-[#1A1A17] hover:underline truncate max-w-[100px] inline-block align-bottom">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-500 text-[#1A1A17]">
                    {formatCurrency(c.profit90d)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#6B6B66]">
                    {c.margin > 0 ? formatPercent(c.margin) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customerList.length > 0 && totalCustomerProfit90d > 0 && (
            <div className="px-4 py-2.5 border-t border-[#E5E5E2] bg-[#F7F7F5]">
              <p className="text-xs text-[#6B6B66]">
                These {customerList.length} customers generate{" "}
                <strong>{topCustomersPct.toFixed(0)}%</strong> of tracked profit.
              </p>
            </div>
          )}
        </div>

        {/* By supplier */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Margin by supplier
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Supplier</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">SKUs</th>
                <th className="text-right px-3 py-2 text-[10px] font-600 text-[#6B6B66] uppercase">Avg margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {(suppliers ?? []).map((s, i) => {
                const margin = s.avg_margin_on_supplied as number;
                const color = margin >= 0.25 ? "#4D7B3D" : margin >= 0.15 ? "#B47214" : "#C54632";
                return (
                  <tr key={s.id as string} className="hover:bg-[#F7F7F5]">
                    <td className="px-3 py-2">
                      <span className="text-[#C8C8C4] mr-1 tabular-nums">{i + 1}.</span>
                      <Link
                        href={`/suppliers/${s.id as string}`}
                        className="font-500 text-[#1A1A17] hover:underline truncate max-w-[100px] inline-block align-bottom"
                      >
                        {s.name as string}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#6B6B66]">
                      {s.products_supplied as number}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-600" style={{ color }}>
                      {formatPercent(margin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Underperformers ────────────────────────────────────── */}
      {lowMargin.length > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Products generating &lt;15% margin
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Rev 90d</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Margin</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Price for 25%</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {lowMargin.map((p) => (
                <tr key={p.sku} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5 text-xs font-500 tabular-nums text-[#1A1A17]">
                    {p.sku}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#6B6B66] max-w-[160px] truncate">{p.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                    {formatCurrency(p.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-600 text-[#C54632]">
                    {formatPercent(p.margin)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#4D7B3D] font-500">
                    {p.suggestedPrice > 0 ? formatCurrency(p.suggestedPrice) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.id && (
                      <Link
                        href={`/products/${p.id}`}
                        className="text-xs text-[#6B6B66] hover:text-[#1A1A17] underline-offset-2 hover:underline transition-colors"
                      >
                        Adjust
                      </Link>
                    )}
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

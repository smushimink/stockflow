import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface CashSlice {
  label: string;
  value: number;
  color: string;
  href: string;
}

function DonutChart({ slices, total }: { slices: CashSlice[]; total: number }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const stroke = 28;

  const nonZero = slices.filter((s) => s.value > 0);
  if (nonZero.length === 0) {
    return (
      <div className="w-[200px] h-[200px] flex items-center justify-center rounded-full border-[28px] border-[#F0F0EE]">
        <span className="text-xs text-[#6B6B66]">No data</span>
      </div>
    );
  }

  let cumulative = 0;
  const paths: { d: string; color: string; label: string; value: number }[] = [];

  for (const slice of nonZero) {
    const pct = slice.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumulative + pct) * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    paths.push({ d, color: slice.color, label: slice.label, value: slice.value });
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F0EE" strokeWidth={stroke} />
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
      {/* Inner hole */}
      <circle cx={cx} cy={cy} r={r - stroke / 2} fill="white" />
    </svg>
  );
}

export default async function CashFlowPage() {
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
    { data: allMetrics },
    { data: openPos },
    { data: topTrapped },
  ] = await Promise.all([
    // All product metrics for cash breakdowns
    supabase
      .from("product_metrics")
      .select(
        "product_id, cash_tied_up, days_of_cover, days_since_last_sale, inventory_turnover, avg_inventory_value, cogs_90d"
      )
      .eq("organization_id", orgId),
    // Open POs (sent or confirmed = cash committed)
    supabase
      .from("purchase_orders")
      .select("total, status")
      .eq("organization_id", orgId)
      .in("status", ["sent", "confirmed"]),
    // Top 10 cash-trapped products (dead + slow)
    supabase
      .from("product_metrics")
      .select(
        `product_id, cash_tied_up, days_since_last_sale,
         products ( id, sku, name )`
      )
      .eq("organization_id", orgId)
      .gte("days_since_last_sale", 60)
      .order("cash_tied_up", { ascending: false })
      .limit(10),
  ]);

  const metrics = allMetrics ?? [];
  const pos = openPos ?? [];

  // ── Hero numbers ──────────────────────────────────────────────
  const totalInventoryCash = metrics.reduce((s, m) => s + (m.cash_tied_up as number), 0);
  const openPosCash = pos.reduce((s, p) => s + (p.total as number), 0);
  const totalDeployed = totalInventoryCash + openPosCash;

  // ── Donut slices ──────────────────────────────────────────────
  let healthyCash = 0;
  let slowCash = 0;
  let deadCash = 0;

  for (const m of metrics) {
    const cover = m.days_of_cover as number;
    const idle = m.days_since_last_sale as number | null;
    const cash = m.cash_tied_up as number;

    if (idle !== null && idle >= 180) {
      deadCash += cash;
    } else if (cover >= 90 && cover < 9999) {
      slowCash += cash;
    } else if (cover < 90) {
      healthyCash += cash;
    } else {
      // cover = 9999 (no sales) and not 180d idle yet
      slowCash += cash;
    }
  }

  const slices: CashSlice[] = [
    { label: "Healthy inventory", value: healthyCash, color: "#4D7B3D", href: "/insights/inventory" },
    { label: "Slow inventory", value: slowCash, color: "#B47214", href: "/insights/inventory" },
    { label: "Dead stock", value: deadCash, color: "#C54632", href: "/insights/dead-stock" },
    { label: "Open POs", value: openPosCash, color: "#9B9B97", href: "/purchases" },
  ];
  const donutTotal = Math.max(1, healthyCash + slowCash + deadCash + openPosCash);

  // ── Cash velocity table ────────────────────────────────────────
  const velocityRows = metrics
    .filter((m) => (m.cash_tied_up as number) > 0)
    .map((m) => {
      const t = m.inventory_turnover as number;
      const color = t >= 4 ? "#4D7B3D" : t >= 2 ? "#B47214" : "#C54632";
      return { product_id: m.product_id as string, turnover: t, color };
    })
    .sort((a, b) => a.turnover - b.turnover)
    .slice(0, 20);

  const turnoverMap = new Map(velocityRows.map((r) => [r.product_id, r]));

  // Fetch product names for velocity table
  const velocityProductIds = velocityRows.map((r) => r.product_id);
  const { data: velocityProducts } = velocityProductIds.length > 0
    ? await supabase
        .from("products")
        .select("id, sku, name, category, abc_class")
        .in("id", velocityProductIds)
    : { data: [] };

  // ── DIO (working capital efficiency) ─────────────────────────
  const totalCogs90d = metrics.reduce((s, m) => s + (m.cogs_90d as number), 0);
  const cogsAnnualized = (totalCogs90d / 90) * 365;
  const avgInventory = metrics.reduce((s, m) => s + (m.avg_inventory_value as number), 0);
  const dio = cogsAnnualized > 0 ? Math.round((avgInventory / cogsAnnualized) * 365) : null;

  // ── Top trapped (dead + slow) ─────────────────────────────────
  const trapped = (topTrapped ?? []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prod = Array.isArray(m.products) ? (m.products as any[])[0] : m.products;
    return {
      id: prod?.id as string,
      sku: prod?.sku as string,
      name: prod?.name as string,
      cashTrapped: m.cash_tied_up as number,
      daysIdle: m.days_since_last_sale as number | null,
    };
  });

  return (
    <div className="space-y-6">
      {/* ── Hero bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <HeroCard
          label="Cash in inventory"
          value={formatCurrency(totalInventoryCash)}
          sub="Current stock × unit cost"
        />
        <HeroCard
          label="Committed in open POs"
          value={formatCurrency(openPosCash)}
          sub={`${pos.length} orders sent or confirmed`}
        />
        <div className="col-span-1 bg-[#1A1A17] rounded-lg px-4 py-3 flex flex-col justify-between">
          <p className="text-xs text-[#9B9B97]">Total cash deployed</p>
          <p className="text-2xl font-600 tabular-nums text-white">
            {formatCurrency(totalDeployed)}
          </p>
          <p className="text-xs text-[#6B6B66]">Working capital</p>
        </div>
      </div>

      {/* ── Where is your cash? ─────────────────────────────── */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-5">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-4">
          Where is your cash sitting?
        </p>
        <div className="flex items-center gap-8">
          <DonutChart slices={slices} total={donutTotal} />
          <div className="flex-1 space-y-2.5">
            {slices.map((s) => {
              const pct = donutTotal > 0 ? ((s.value / donutTotal) * 100).toFixed(1) : "0.0";
              return (
                <Link
                  key={s.label}
                  href={s.href}
                  className="flex items-center justify-between group hover:bg-[#F7F7F5] rounded px-2 py-1 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-[#1A1A17]">{s.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-600 tabular-nums text-[#1A1A17]">
                      {formatCurrency(s.value)}
                    </span>
                    <span className="text-xs text-[#6B6B66] ml-2">{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Cash trapped ─────────────────────────────────────── */}
      {trapped.length > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Cash trapped — top 10 slow & dead SKUs
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Product</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Days idle</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Cash trapped</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {trapped.map((p) => (
                <tr key={p.sku} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-500 text-[#1A1A17]">{p.sku}</p>
                    <p className="text-xs text-[#6B6B66] truncate max-w-[220px]">{p.name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    <span
                      className="font-500"
                      style={{
                        color:
                          p.daysIdle === null || p.daysIdle >= 180
                            ? "#C54632"
                            : p.daysIdle >= 90
                            ? "#B47214"
                            : "#6B6B66",
                      }}
                    >
                      {p.daysIdle !== null ? `${p.daysIdle}d` : "Never sold"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-600 text-[#1A1A17]">
                    {formatCurrency(p.cashTrapped)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.id && (
                      <Link
                        href={`/products/${p.id}`}
                        className="text-xs text-[#6B6B66] hover:text-[#1A1A17] underline-offset-2 hover:underline transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cash velocity ─────────────────────────────────────── */}
      {velocityProducts && velocityProducts.length > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E2]">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Cash velocity — slowest-turning SKUs
            </p>
            <p className="text-xs text-[#6B6B66] mt-0.5">
              Green = 4+ cycles/year · Yellow = 2–4 · Red = under 2
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2]">
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Class</th>
                <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Turnover (×/yr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {velocityProducts.map((p) => {
                const row = turnoverMap.get(p.id as string);
                if (!row) return null;
                return (
                  <tr key={p.id as string} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-2.5 text-xs font-500 tabular-nums text-[#1A1A17]">
                      {p.sku as string}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6B6B66] max-w-[180px] truncate">
                      {p.name as string}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6B6B66]">{(p.category as string) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6B6B66]">{(p.abc_class as string) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-600" style={{ color: row.color }}>
                      {row.turnover > 0 ? row.turnover.toFixed(1) : "0.0"}×
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Working capital efficiency ─────────────────────────── */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-5">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-3">
          Working capital efficiency
        </p>
        {dio !== null ? (
          <div className="flex items-end gap-3">
            <p className="text-4xl font-600 tabular-nums text-[#1A1A17]">{dio}</p>
            <div className="pb-1">
              <p className="text-sm text-[#6B6B66]">days</p>
              <p className="text-xs text-[#6B6B66]">
                Your cash sits in inventory for <strong>{dio} days</strong> before being recovered through sales.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#6B6B66]">
            Not enough sales data to compute cash conversion cycle.
          </p>
        )}
        <p className="text-xs text-[#C8C8C4] mt-3">
          DIO = avg inventory value ÷ (annualised COGS ÷ 365). DSO and DPO require payment integration.
        </p>
      </div>
    </div>
  );
}

function HeroCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-2xl font-600 tabular-nums text-[#1A1A17]">{value}</p>
      <p className="text-xs text-[#6B6B66]">{sub}</p>
    </div>
  );
}

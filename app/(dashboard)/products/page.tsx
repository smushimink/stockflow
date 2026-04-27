import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Supabase returns joins as arrays in the untyped client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function first<T>(v: unknown): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v as T[])[0] ?? null;
  return v as T;
}

const FILTER_OPTIONS = [
  { id: "all", label: "All active" },
  { id: "reorder", label: "Need reorder" },
  { id: "dead", label: "Dead stock" },
  { id: "class_a", label: "Class A" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createClient();
  const { filter = "all" } = await searchParams;

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

  // Overview stats
  const [
    { count: needReorderCount },
    { data: deadStockAlerts },
    { count: healthyCount },
    { count: seasonalCount },
  ] = await Promise.all([
    supabase
      .from("decision_alerts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("rule_type", "reorder")
      .eq("status", "pending"),
    supabase
      .from("decision_alerts")
      .select("suggested_value, metadata")
      .eq("organization_id", orgId)
      .eq("rule_type", "dead_stock")
      .eq("status", "pending"),
    supabase
      .from("product_metrics")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gt("days_of_cover", 30),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active")
      .not("season_tags", "eq", "{}"),
  ]);

  const cashInDeadStock = (deadStockAlerts ?? []).reduce(
    (sum, a) => sum + ((a.metadata as Record<string, unknown>)?.cash_tied_up as number ?? 0),
    0
  );

  // Products list
  let productsQuery = supabase
    .from("products")
    .select(`
      id, sku, name, stock_on_hand, reorder_point, selling_price, unit_cost,
      status, abc_class, category,
      suppliers(name),
      product_metrics(days_of_cover, real_margin_pct, days_since_last_sale),
      decision_alerts(id, rule_type, severity)
    `)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("name");

  if (filter === "reorder") {
    productsQuery = productsQuery.lte("stock_on_hand", supabase.rpc as unknown as number);
  }

  const { data: products } = await supabase
    .from("products")
    .select(`
      id, sku, name, stock_on_hand, reorder_point, selling_price, unit_cost,
      status, abc_class, category,
      suppliers(name),
      product_metrics(days_of_cover, real_margin_pct, days_since_last_sale),
      decision_alerts(id, rule_type, severity, status)
    `)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("name");

  const filteredProducts = (products ?? []).filter((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alerts = ((p as any).decision_alerts as { rule_type: string; status: string }[] | null) ?? [];
    const pendingAlerts = alerts.filter((a) => a.status === "pending");

    if (filter === "reorder") return p.stock_on_hand <= p.reorder_point;
    if (filter === "dead") return pendingAlerts.some((a) => a.rule_type === "dead_stock");
    if (filter === "class_a") return p.abc_class === "A";
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-600 text-[#1A1A17]">Products</h1>
      </div>

      {/* Overview bar */}
      <div className="grid grid-cols-4 gap-3">
        <OverviewCell
          label="Need reorder"
          value={String(needReorderCount ?? 0)}
          color="#C54632"
          href="/products?filter=reorder"
        />
        <OverviewCell
          label="Cash in dead stock"
          value={formatCurrency(cashInDeadStock)}
          color="#B47214"
          href="/products?filter=dead"
        />
        <OverviewCell
          label="Healthy SKUs"
          value={String(healthyCount ?? 0)}
          color="#4D7B3D"
        />
        <OverviewCell
          label="Seasonal SKUs"
          value={String(seasonalCount ?? 0)}
          color="#6B6B66"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((f) => (
          <Link
            key={f.id}
            href={`/products?filter=${f.id}`}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-500 border transition-colors",
              filter === f.id
                ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#C8C8C4]"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#E5E5E2] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Product</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Stock</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Cover</th>
              <th className="text-center px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Status</th>
              <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Margin</th>
              <th className="text-center px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Class</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {filteredProducts.map((p) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pa = p as any;
              type Metrics = { days_of_cover: number; real_margin_pct: number; days_since_last_sale: number | null };
              const metrics = first<Metrics>(pa.product_metrics);
              const alerts = (pa.decision_alerts as { rule_type: string; severity: string; status: string }[] | null) ?? [];
              const pendingAlerts = alerts.filter((a) => a.status === "pending");
              const hasReorder = p.stock_on_hand <= p.reorder_point;
              const hasDeadStock = pendingAlerts.some((a) => a.rule_type === "dead_stock");
              const supplier = first<{ name: string }>(pa.suppliers);

              const statusLabel = hasReorder ? "Reorder" : hasDeadStock ? "Dead stock" : "Healthy";
              const statusColor = hasReorder ? "text-[#C54632]" : hasDeadStock ? "text-[#B47214]" : "text-[#4D7B3D]";
              const statusDot = hasReorder ? "bg-[#C54632]" : hasDeadStock ? "bg-[#B47214]" : "bg-[#4D7B3D]";

              const actionLabel = hasReorder
                ? `Order ${Math.max(p.reorder_point * 2 - p.stock_on_hand, 10)}`
                : hasDeadStock
                ? "−50%"
                : "View";

              return (
                <tr key={p.id} className="hover:bg-[#F7F7F5] group">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-500 text-[#1A1A17]">{p.name}</p>
                      <p className="text-xs text-[#6B6B66]">
                        {p.sku}
                        {supplier?.name && <> · {supplier.name}</>}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#1A1A17]">
                    {p.stock_on_hand}
                    {hasReorder && (
                      <span className="ml-1 text-[10px] text-[#C54632]">↓{p.reorder_point}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">
                    {metrics?.days_of_cover
                      ? metrics.days_of_cover > 999
                        ? "—"
                        : `${Math.round(metrics.days_of_cover)}d`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
                      <span className={cn("text-xs font-500", statusColor)}>{statusLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {metrics?.real_margin_pct !== undefined ? (
                      <span className={cn(
                        metrics.real_margin_pct < 0.15 ? "text-[#C54632]" :
                        metrics.real_margin_pct < 0.25 ? "text-[#B47214]" : "text-[#4D7B3D]"
                      )}>
                        {formatPercent(metrics.real_margin_pct)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.abc_class ? (
                      <Badge variant="outline" className="text-xs font-600 px-2">
                        {p.abc_class}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/products/${p.id}`}
                        className="text-xs text-[#6B6B66] hover:text-[#1A1A17] transition-colors border border-[#E5E5E2] rounded px-2 py-1 bg-white hover:border-[#C8C8C4]"
                      >
                        {actionLabel}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-sm text-[#6B6B66]">
            No products match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCell({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: string;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-1">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-xl font-600 tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

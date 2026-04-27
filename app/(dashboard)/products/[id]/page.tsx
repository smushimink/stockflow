import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ProductPricingTab } from "@/components/products/product-pricing-tab";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: product } = await supabase
    .from("products")
    .select(`
      *, suppliers(name, lead_time_days, moq)
    `)
    .eq("id", id)
    .single();

  if (!product) notFound();

  const { data: metrics } = await supabase
    .from("product_metrics")
    .select("*")
    .eq("product_id", id)
    .single();

  const { data: pendingAlerts } = await supabase
    .from("decision_alerts")
    .select("id, rule_type, severity, title, summary, suggested_action, suggested_value")
    .eq("related_product_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: history } = await supabase
    .from("data_provenance")
    .select("*")
    .eq("record_id", id)
    .order("changed_at", { ascending: false })
    .limit(20);

  const supplier = product.suppliers as { name: string; lead_time_days: number; moq: number } | null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#6B6B66]">
        <Link href="/products" className="hover:text-[#1A1A17]">Products</Link>
        <ChevronRight size={12} />
        <span className="text-[#1A1A17] font-500">{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-600 text-[#1A1A17]">{product.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[#6B6B66]">{product.sku}</span>
            {product.category && (
              <>
                <span className="text-[#E5E5E2]">·</span>
                <span className="text-sm text-[#6B6B66]">{product.category}</span>
              </>
            )}
            {product.abc_class && (
              <span className="text-xs font-600 border border-[#E5E5E2] rounded px-1.5 py-0.5 text-[#6B6B66]">
                Class {product.abc_class}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending alert card */}
      {(pendingAlerts ?? []).map((alert) => {
        const severityBg = alert.severity === "red" ? "bg-[#FDF2F0] border-[#C54632]/20" :
          alert.severity === "orange" ? "bg-[#FDF8EE] border-[#B47214]/20" :
          "bg-white border-[#E5E5E2]";
        const dotColor = alert.severity === "red" ? "bg-[#C54632]" :
          alert.severity === "orange" ? "bg-[#B47214]" : "bg-[#B47214] opacity-60";

        return (
          <div key={alert.id} className={cn("border rounded-lg px-4 py-3 flex items-start gap-3", severityBg)}>
            <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", dotColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-500 text-[#1A1A17]">{alert.title}</p>
              <p className="text-xs text-[#6B6B66] mt-0.5">{alert.summary}</p>
            </div>
            {alert.suggested_action && (
              <span className="text-xs text-[#6B6B66] shrink-0">{alert.suggested_action}</span>
            )}
          </div>
        );
      })}

      {/* 3-metric row */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCell
          label="Stock cover"
          value={metrics?.days_of_cover
            ? metrics.days_of_cover > 999 ? "Overstocked" : `${Math.round(metrics.days_of_cover)} days`
            : "No sales data"}
          sub={`${product.stock_on_hand} units on hand`}
        />
        <MetricCell
          label="Real margin"
          value={metrics?.real_margin_pct !== undefined
            ? formatPercent(metrics.real_margin_pct)
            : "—"}
          sub={`Cost: ${formatCurrency(product.unit_cost)}`}
          valueColor={
            metrics?.real_margin_pct !== undefined
              ? metrics.real_margin_pct < 0.15 ? "#C54632"
              : metrics.real_margin_pct < 0.25 ? "#B47214"
              : "#4D7B3D"
              : undefined
          }
        />
        <MetricCell
          label="Sales last 90d"
          value={metrics?.units_sold_90d !== undefined
            ? `${metrics.units_sold_90d} units`
            : "—"}
          sub={metrics?.revenue_90d !== undefined
            ? `${formatCurrency(metrics.revenue_90d)} revenue`
            : undefined}
        />
      </div>

      {/* Tabs */}
      <ProductPricingTab product={product} metrics={metrics} supplier={supplier} history={history ?? []} />
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-lg font-600 tabular-nums" style={{ color: valueColor ?? "#1A1A17" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#6B6B66]">{sub}</p>}
    </div>
  );
}

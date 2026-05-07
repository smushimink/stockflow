import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ForecastClient } from "@/components/insights/forecast-client";

export const dynamic = "force-dynamic";

export interface ForecastRow {
  product_id: string;
  sku: string;
  name: string;
  lambda: number | null;
  k: number | null;
  fit_quality: number | null;
  demand_pattern: string | null;
  lead_time_days_used: number | null;
  ltd_mean: number | null;
  ltd_stddev: number | null;
  ltd_p50: number | null;
  ltd_p95: number | null;
  recommended_rop: number | null;
  recommended_target_stock: number | null;
  recommended_order_qty: number | null;
  service_level_used: number | null;
  critical_ratio: number | null;
  censored_days: number | null;
  data_points: number | null;
  warning: string | null;
  calculated_at: string | null;
  // from product join
  stock_on_hand: number;
  unit_cost: number;
  selling_price: number;
  // deterministic comparison
  det_rop: number | null;
}

export default async function ForecastPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id as string;

  // ── Forecasts joined with product info ────────────────────────────────────

  const { data: forecasts } = await supabase
    .from("product_forecasts")
    .select(`
      product_id, lambda, k, fit_quality, demand_pattern,
      lead_time_days_used, ltd_mean, ltd_stddev, ltd_p50, ltd_p95,
      recommended_rop, recommended_target_stock, recommended_order_qty,
      service_level_used, critical_ratio,
      censored_days, data_points, warning, calculated_at,
      products ( sku, name, stock_on_hand, unit_cost, selling_price, lead_time_days )
    `)
    .eq("organization_id", orgId)
    .order("fit_quality", { ascending: false });

  // ── Product count (to show coverage) ─────────────────────────────────────

  const { count: totalProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");

  // ── Build display rows ────────────────────────────────────────────────────

  const rows: ForecastRow[] = (forecasts ?? []).map((f) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = Array.isArray(f.products) ? (f.products as any[])[0] : f.products as any;
    const avgDaily = (f.lambda as number | null) ?? 0;
    const lt = (f.lead_time_days_used as number | null) ?? (p?.lead_time_days ?? 14);
    const detRop = avgDaily > 0 ? Math.ceil(avgDaily * lt * 1.3) : null;

    return {
      product_id: f.product_id as string,
      sku: (p?.sku as string) ?? "—",
      name: (p?.name as string) ?? "Unknown",
      lambda: f.lambda as number | null,
      k: f.k as number | null,
      fit_quality: f.fit_quality as number | null,
      demand_pattern: f.demand_pattern as string | null,
      lead_time_days_used: f.lead_time_days_used as number | null,
      ltd_mean: f.ltd_mean as number | null,
      ltd_stddev: f.ltd_stddev as number | null,
      ltd_p50: f.ltd_p50 as number | null,
      ltd_p95: f.ltd_p95 as number | null,
      recommended_rop: f.recommended_rop as number | null,
      recommended_target_stock: f.recommended_target_stock as number | null,
      recommended_order_qty: f.recommended_order_qty as number | null,
      service_level_used: f.service_level_used as number | null,
      critical_ratio: f.critical_ratio as number | null,
      censored_days: f.censored_days as number | null,
      data_points: f.data_points as number | null,
      warning: f.warning as string | null,
      calculated_at: f.calculated_at as string | null,
      stock_on_hand: (p?.stock_on_hand as number) ?? 0,
      unit_cost: (p?.unit_cost as number) ?? 0,
      selling_price: (p?.selling_price as number) ?? 0,
      det_rop: detRop,
    };
  });

  const lastRun = rows[0]?.calculated_at ?? null;

  return (
    <ForecastClient
      rows={rows}
      totalProducts={totalProducts ?? 0}
      lastRun={lastRun}
    />
  );
}

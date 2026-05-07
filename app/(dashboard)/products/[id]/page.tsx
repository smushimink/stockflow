import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatPercent, firstOf, cn, formatAgo } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { ProductPricingTab } from "@/components/products/product-pricing-tab";
import { calculatePriceElasticity } from "@/lib/analytics/elasticity";
import type { AnalyticsData } from "@/components/products/product-analytics-tab";

export const dynamic = "force-dynamic";

export interface DailySales {
  date: string;
  units: number;
}

export interface CustomerBreakdown {
  id: string | null;
  name: string;
  qty: number;
  revenue: number;
}

export interface ProductPo {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  received_at: string | null;
  expected_at: string | null;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

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

  const [
    { data: product },
    { data: metrics },
    { data: pendingAlerts },
    { data: history },
    { data: rawSalesItems },
    { data: rawPoItems },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, suppliers(id, name, lead_time_days, moq)")
      .eq("id", id)
      .single(),
    supabase
      .from("product_metrics")
      .select("*")
      .eq("product_id", id)
      .single(),
    supabase
      .from("decision_alerts")
      .select("id, rule_type, severity, title, summary, suggested_action, suggested_value")
      .eq("related_product_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("data_provenance")
      .select("*")
      .eq("record_id", id)
      .order("changed_at", { ascending: false })
      .limit(20),
    // All sales order items for this product (last 90d computed in TS)
    supabase
      .from("sales_order_items")
      .select(`qty, total, unit_price,
        sales_orders ( id, ordered_at, status, customer_id, customers ( id, name ) )`)
      .eq("product_id", id),
    // All PO items for this product
    supabase
      .from("purchase_order_items")
      .select(`qty_ordered, qty_received, unit_cost,
        purchase_orders ( id, order_number, status, created_at, received_at, expected_at )`)
      .eq("product_id", id),
  ]);

  if (!product) notFound();

  // ── Build dailySales (last 90 days) ──────────────────────────
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 86400000;

  const dailyMap = new Map<string, number>();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }

  for (const item of rawSalesItems ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = firstOf<any>(item.sales_orders as any);
    if (!order || order.status !== "completed") continue;
    const ts = new Date(order.ordered_at as string).getTime();
    if (ts < ninetyDaysAgo) continue;
    const key = new Date(ts).toISOString().split("T")[0];
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + (item.qty as number));
  }
  const dailySales: DailySales[] = Array.from(dailyMap.entries()).map(([date, units]) => ({ date, units }));

  // ── Customer breakdown ────────────────────────────────────────
  const custMap = new Map<string, CustomerBreakdown>();
  for (const item of rawSalesItems ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = firstOf<any>(item.sales_orders as any);
    if (!order || order.status !== "completed") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cust = firstOf<any>(order.customers as any);
    const custId = (order.customer_id as string | null) ?? "unknown";
    const name = (cust?.name as string) ?? "Guest";
    const existing = custMap.get(custId);
    if (existing) {
      existing.qty += item.qty as number;
      existing.revenue += item.total as number;
    } else {
      custMap.set(custId, { id: order.customer_id as string | null, name, qty: item.qty as number, revenue: item.total as number });
    }
  }
  const customerBreakdown: CustomerBreakdown[] = [...custMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // ── Product POs ───────────────────────────────────────────────
  const productPos: ProductPo[] = (rawPoItems ?? [])
    .map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const po = firstOf<any>(item.purchase_orders as any);
      if (!po?.id) return null;
      return {
        id: po.id as string,
        order_number: po.order_number as string,
        status: po.status as string,
        created_at: po.created_at as string,
        received_at: (po.received_at as string | null) ?? null,
        expected_at: (po.expected_at as string | null) ?? null,
        qty_ordered: item.qty_ordered as number,
        qty_received: item.qty_received as number,
        unit_cost: item.unit_cost as number,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime()) as ProductPo[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supplier = firstOf<{ id: string; name: string; lead_time_days: number; moq: number }>(product.suppliers as any) ?? null;

  // ── Analytics data ────────────────────────────────────────────────────────
  // 90-day customer breakdown (separate from the all-time customerBreakdown above)
  const custMap90d = new Map<string, CustomerBreakdown>();
  for (const item of rawSalesItems ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = firstOf<any>(item.sales_orders as any);
    if (!order || order.status !== "completed") continue;
    const ts = new Date(order.ordered_at as string).getTime();
    if (ts < ninetyDaysAgo) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cust = firstOf<any>(order.customers as any);
    const custId = (order.customer_id as string | null) ?? "guest";
    const existing = custMap90d.get(custId);
    if (existing) {
      existing.qty += item.qty as number;
      existing.revenue += item.total as number;
    } else {
      custMap90d.set(custId, {
        id: order.customer_id as string | null,
        name: (cust?.name as string) ?? "Guest",
        qty: item.qty as number,
        revenue: item.total as number,
      });
    }
  }
  const topCustomers90d = [...custMap90d.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const totalRevenue90d = [...custMap90d.values()].reduce((s, c) => s + c.revenue, 0);

  // Order IDs (completed, for co-purchase query)
  const orderIds = [
    ...new Set(
      (rawSalesItems ?? []).flatMap((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = firstOf<any>(item.sales_orders as any);
        return order?.status === "completed" && order.id ? [order.id as string] : [];
      })
    ),
  ];

  // Stockout estimation from daily sales + metrics
  const stockOnHand = product.stock_on_hand as number;
  const avgDailySales = (metrics?.avg_daily_sales_30d as number | null) ?? 0;
  const daysSinceLastSale = (metrics?.days_since_last_sale as number | null) ?? 0;
  const isCurrentlyStockedOut = stockOnHand === 0 && avgDailySales > 0.05;

  const MIN_STOCKOUT_RUN = 7;
  let historicalStockoutDays = 0;
  if (avgDailySales > 0.1) {
    let run = 0;
    for (const day of dailySales) {
      if (day.units === 0) {
        run++;
      } else {
        if (run >= MIN_STOCKOUT_RUN) historicalStockoutDays += run;
        run = 0;
      }
    }
    if (run >= MIN_STOCKOUT_RUN && !isCurrentlyStockedOut) historicalStockoutDays += run;
  }
  const currentStockoutDays = isCurrentlyStockedOut ? Math.min(90, daysSinceLastSale) : 0;
  const stockoutDays90 = Math.min(90, currentStockoutDays + historicalStockoutDays);
  const avgDiscount = (metrics?.avg_discount as number | null) ?? 0;
  const platformFee = (metrics?.avg_platform_fee as number | null) ?? 0;
  const profitPerUnit = Math.max(
    0,
    (product.selling_price as number) - (product.unit_cost as number) - avgDiscount - platformFee
  );
  const estimatedLostProfit = stockoutDays90 * avgDailySales * profitPerUnit;

  // Run elasticity + co-purchase + category products in parallel
  const [elasticityRaw, coItemsData, catProductsData] = await Promise.all([
    calculatePriceElasticity(id).catch(() => null),
    orderIds.length > 0
      ? supabase
          .from("sales_order_items")
          .select("product_id, sku, name")
          .in("order_id", orderIds.slice(0, 300))
          .neq("product_id", id)
      : Promise.resolve({ data: null, error: null }),
    (product.category as string | null)
      ? supabase
          .from("products")
          .select("id")
          .eq("category", product.category as string)
          .eq("status", "active")
          .neq("id", id)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Category avg margin
  let categoryAvgMarginPct: number | null = null;
  if (catProductsData.data && catProductsData.data.length > 0) {
    const catIds = catProductsData.data.map((p) => p.id as string);
    const { data: catMetrics } = await supabase
      .from("product_metrics")
      .select("real_margin_pct")
      .in("product_id", catIds)
      .not("real_margin_pct", "is", null);
    if (catMetrics && catMetrics.length > 0) {
      categoryAvgMarginPct =
        catMetrics.reduce((s, m) => s + (m.real_margin_pct as number), 0) / catMetrics.length;
    }
  }

  // Co-purchase count map
  const coPurchaseMap = new Map<string, { sku: string; name: string; count: number }>();
  for (const item of coItemsData.data ?? []) {
    const pid = item.product_id as string | null;
    if (!pid) continue;
    const existing = coPurchaseMap.get(pid) ?? {
      sku: item.sku as string,
      name: item.name as string,
      count: 0,
    };
    existing.count++;
    coPurchaseMap.set(pid, existing);
  }
  const coPurchase = [...coPurchaseMap.entries()]
    .map(([product_id, { sku, name, count }]) => ({ product_id, sku, name, co_count: count }))
    .sort((a, b) => b.co_count - a.co_count)
    .slice(0, 5);

  // Elasticity shape for client
  const elasticity: AnalyticsData["elasticity"] =
    elasticityRaw && elasticityRaw.classification !== "unknown"
      ? {
          elasticity: elasticityRaw.elasticity,
          classification: elasticityRaw.classification,
          confidence: elasticityRaw.confidence,
          data_points: elasticityRaw.data_points,
          distinct_prices: elasticityRaw.distinct_prices,
          recommended_price: elasticityRaw.recommended_price,
          expected_units_at_recommended: elasticityRaw.expected_units_at_recommended,
          expected_profit_at_recommended: elasticityRaw.expected_profit_at_recommended,
          baseline_profit: elasticityRaw.baseline_profit,
          unit_cost: elasticityRaw.unit_cost,
          current_price: elasticityRaw.current_price,
          insight: elasticityRaw.insight,
          observations: elasticityRaw.observations.slice(-150).map((o) => ({
            price: o.price,
            qty: o.qty,
          })),
        }
      : elasticityRaw
      ? {
          // unknown classification — still pass so UI can show the message
          elasticity: 0,
          classification: "unknown",
          confidence: 0,
          data_points: elasticityRaw.data_points,
          distinct_prices: elasticityRaw.distinct_prices,
          recommended_price: elasticityRaw.recommended_price,
          expected_units_at_recommended: 0,
          expected_profit_at_recommended: 0,
          baseline_profit: 0,
          unit_cost: elasticityRaw.unit_cost,
          current_price: elasticityRaw.current_price,
          insight: elasticityRaw.insight,
          observations: [],
        }
      : null;

  const grossProfit =
    (product.selling_price as number) -
    (product.unit_cost as number) -
    avgDiscount -
    platformFee;

  const analyticsData: AnalyticsData = {
    elasticity,
    perUnit: {
      revenue: product.selling_price as number,
      cogs: product.unit_cost as number,
      avgDiscount,
      platformFee,
      grossProfit,
      realMarginPct:
        (metrics?.real_margin_pct as number | null) ??
        ((product.selling_price as number) > 0
          ? grossProfit / (product.selling_price as number)
          : 0),
    },
    categoryAvgMarginPct,
    stockoutDays90,
    estimatedLostProfit,
    isCurrentlyStockedOut,
    avgDailySales,
    topCustomers90d,
    totalRevenue90d,
    coPurchase,
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#6B6B66]">
        <Link href="/products" className="hover:text-[#1A1A17]">Products</Link>
        <ChevronRight size={12} />
        <span className="text-[#1A1A17] font-500">{product.name as string}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-600 text-[#1A1A17]">{product.name as string}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[#6B6B66]">{product.sku as string}</span>
            {product.category && (
              <>
                <span className="text-[#E5E5E2]">·</span>
                <span className="text-sm text-[#6B6B66]">{product.category as string}</span>
              </>
            )}
            {product.abc_class && (
              <span className="text-xs font-600 border border-[#E5E5E2] rounded px-1.5 py-0.5 text-[#6B6B66]">
                Class {product.abc_class as string}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pending alerts */}
      {(pendingAlerts ?? []).map((alert) => {
        const severityBg =
          alert.severity === "red" ? "bg-[#FDF2F0] border-[#C54632]/20" :
          alert.severity === "orange" ? "bg-[#FDF8EE] border-[#B47214]/20" :
          "bg-white border-[#E5E5E2]";
        const dotColor =
          alert.severity === "red" ? "bg-[#C54632]" :
          alert.severity === "orange" ? "bg-[#B47214]" : "bg-[#B47214] opacity-60";
        return (
          <div key={alert.id} className={cn("border rounded-lg px-4 py-3 flex items-start gap-3", severityBg)}>
            <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", dotColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-500 text-[#1A1A17]">{alert.title as string}</p>
              <p className="text-xs text-[#6B6B66] mt-0.5">{alert.summary as string}</p>
            </div>
            {alert.suggested_action && (
              <span className="text-xs text-[#6B6B66] shrink-0">{alert.suggested_action as string}</span>
            )}
          </div>
        );
      })}

      {/* 3-metric row */}
      {metrics?.calculated_at && (
        <p className="text-[10px] text-[#6B6B66]">
          Metrics updated {formatAgo(metrics.calculated_at as string)}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <MetricCell
          label="Stock cover"
          value={
            metrics?.days_of_cover
              ? (metrics.days_of_cover as number) > 999 ? "Overstocked" : `${Math.round(metrics.days_of_cover as number)} days`
              : "No sales data"
          }
          sub={`${product.stock_on_hand as number} units on hand`}
        />
        <MetricCell
          label="Real margin"
          value={metrics?.real_margin_pct !== undefined ? formatPercent(metrics.real_margin_pct as number) : "—"}
          sub={`Cost: ${formatCurrency(product.unit_cost as number)}`}
          valueColor={
            metrics?.real_margin_pct !== undefined
              ? (metrics.real_margin_pct as number) < 0.15 ? "#C54632"
              : (metrics.real_margin_pct as number) < 0.25 ? "#B47214"
              : "#4D7B3D"
              : undefined
          }
        />
        <MetricCell
          label="Sales last 90d"
          value={metrics?.units_sold_90d !== undefined ? `${metrics.units_sold_90d as number} units` : "—"}
          sub={metrics?.revenue_90d !== undefined ? `${formatCurrency(metrics.revenue_90d as number)} revenue` : undefined}
        />
      </div>

      {/* Tabs */}
      <ProductPricingTab
        product={product}
        metrics={metrics}
        supplier={supplier}
        history={history ?? []}
        dailySales={dailySales}
        customerBreakdown={customerBreakdown}
        productPos={productPos}
        analyticsData={analyticsData}
      />
    </div>
  );
}

function MetricCell({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-lg font-600 tabular-nums" style={{ color: valueColor ?? "#1A1A17" }}>{value}</p>
      {sub && <p className="text-xs text-[#6B6B66]">{sub}</p>}
    </div>
  );
}

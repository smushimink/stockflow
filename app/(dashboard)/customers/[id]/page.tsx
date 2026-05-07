import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";
import type { Customer } from "@/lib/supabase/types";
import { runCustomerClvRegression } from "@/lib/analytics/regression-models";
import type { ProfitDeepDiveData } from "@/components/customers/customer-profitability-deep-dive";

export const dynamic = "force-dynamic";

export interface CustomerOrderItem {
  id: string;
  product_id: string | null;
  sku: string;
  name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  total: number;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  ordered_at: string;
  items: CustomerOrderItem[];
}

export interface ChurnAlertData {
  id: string;
  days_since_last_order: number;
  avg_order_interval_days: number;
  threshold_days: number;
  summary: string;
}

export default async function CustomerDetailPage({
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

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;

  const [{ data: customer }, { data: orders }, { data: churnAlert }] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("sales_orders")
      .select(`
        id, order_number, status, total, ordered_at,
        sales_order_items ( id, product_id, sku, name, qty, unit_price, unit_cost, discount, total )
      `)
      .eq("organization_id", orgId)
      .eq("customer_id", id)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("decision_alerts")
      .select("id, summary, metadata, status")
      .eq("organization_id", orgId)
      .eq("related_customer_id", id)
      .eq("rule_type", "customer_churn")
      .eq("status", "pending")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!customer) notFound();

  const normalizedOrders: CustomerOrder[] = (orders ?? []).map((o) => {
    const rawItems = o.sales_order_items;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    return {
      id: o.id as string,
      order_number: o.order_number as string,
      status: o.status as string,
      total: o.total as number,
      ordered_at: o.ordered_at as string,
      items: items.map((item) => ({
        id: item.id as string,
        product_id: item.product_id as string | null,
        sku: item.sku as string,
        name: item.name as string,
        qty: item.qty as number,
        unit_price: item.unit_price as number,
        unit_cost: (item.unit_cost as number) ?? 0,
        discount: (item.discount as number) ?? 0,
        total: item.total as number,
      })),
    };
  });

  let churnAlertData: ChurnAlertData | null = null;
  if (churnAlert) {
    const meta = churnAlert.metadata as Record<string, unknown>;
    churnAlertData = {
      id: churnAlert.id as string,
      days_since_last_order: (meta.days_since_last_order as number) ?? 0,
      avg_order_interval_days: (meta.avg_order_interval_days as number) ?? 0,
      threshold_days: (meta.threshold_days as number) ?? 0,
      summary: churnAlert.summary as string,
    };
  }

  // Collect all product IDs this customer has ever bought
  const allProductIds = [
    ...new Set(
      normalizedOrders.flatMap((o) =>
        o.items.map((i) => i.product_id).filter((pid): pid is string => pid !== null)
      )
    ),
  ];

  // Fetch data for profitability deep dive in parallel
  const [customerProductsRes, orgProductsRes, clvResultRaw] = await Promise.all([
    allProductIds.length > 0
      ? supabase
          .from("products")
          .select("id, category")
          .in("id", allProductIds)
      : Promise.resolve({ data: [] as Array<{ id: string; category: string | null }>, error: null }),
    supabase
      .from("products")
      .select("id, category")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    runCustomerClvRegression(orgId).catch(() => null),
  ]);

  // product_id → category map for this customer
  const productCategories: Record<string, string | null> = {};
  for (const p of customerProductsRes.data ?? []) {
    productCategories[p.id] = p.category;
  }

  // Org avg margin and category margins
  const orgProductIds = (orgProductsRes.data ?? []).map((p) => p.id);
  let orgAvgMarginPct: number | null = null;
  const categoryOrgMargins: Record<string, number> = {};

  if (orgProductIds.length > 0) {
    const { data: metricsData } = await supabase
      .from("product_metrics")
      .select("product_id, real_margin_pct")
      .in("product_id", orgProductIds);

    if (metricsData && metricsData.length > 0) {
      const allMargins = metricsData
        .map((m) => m.real_margin_pct as number | null)
        .filter((v): v is number => v !== null);
      orgAvgMarginPct = allMargins.length > 0 ? allMargins.reduce((s, v) => s + v, 0) / allMargins.length : null;

      // Category breakdown
      const catAccum = new Map<string, number[]>();
      for (const m of metricsData) {
        const pid = m.product_id as string;
        const orgProd = (orgProductsRes.data ?? []).find((p) => p.id === pid);
        const cat = orgProd?.category ?? null;
        const margin = m.real_margin_pct as number | null;
        if (cat && margin !== null) {
          const arr = catAccum.get(cat) ?? [];
          arr.push(margin);
          catAccum.set(cat, arr);
        }
      }
      for (const [cat, vals] of catAccum) {
        categoryOrgMargins[cat] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
    }
  }

  // CLV: predict for this customer using the org-level coefficients
  let predictedClv: number | null = null;
  let orgAvgClv: number | null = null;
  if (clvResultRaw && !clvResultRaw.insufficient_data && clvResultRaw.coefficients.length >= 4) {
    const [intercept, monthlyRateCoef, freqCoef, intervalCoef] = clvResultRaw.coefficients.map(
      (c) => c.coefficient
    );
    const completedCount = normalizedOrders.filter(
      (o) => o.status === "completed" || o.status === "delivered"
    ).length;
    const c = customer as Customer & {
      avg_order_interval_days?: number | null;
      created_at?: string | null;
    };
    const daysAgo = c.created_at
      ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (24 * 3600 * 1000))
      : 365;
    const monthsActive = Math.max(1, daysAgo / 30);
    const monthlyRevRate = (customer.total_spent as number) / monthsActive;
    const orderFrequency = completedCount / monthsActive;
    const avgInterval = (c.avg_order_interval_days as number | null | undefined) ?? 90;
    predictedClv =
      intercept +
      monthlyRateCoef * monthlyRevRate +
      freqCoef * orderFrequency +
      intervalCoef * avgInterval;
    // org avg CLV from segment data
    const allSegAvg = clvResultRaw.segment_avg_clv;
    if (allSegAvg.length > 0) {
      const totalN = allSegAvg.reduce((s, sg) => s + sg.n, 0);
      orgAvgClv = totalN > 0
        ? allSegAvg.reduce((s, sg) => s + sg.avg_clv * sg.n, 0) / totalN
        : null;
    }
  }

  const deepDiveData: ProfitDeepDiveData = {
    productCategories,
    orgAvgMarginPct,
    categoryOrgMargins,
    predictedClv,
    orgAvgClv,
  };

  return (
    <CustomerDetailClient
      customer={customer as Customer}
      orders={normalizedOrders}
      churnAlert={churnAlertData}
      deepDive={deepDiveData}
    />
  );
}

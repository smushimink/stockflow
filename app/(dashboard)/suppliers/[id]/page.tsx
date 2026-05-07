import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { SupplierDetailClient } from "@/components/suppliers/supplier-detail-client";
import type { Supplier } from "@/lib/supabase/types";
import type { SupplierEconomicData } from "@/components/suppliers/supplier-economic-analysis";

export const dynamic = "force-dynamic";

export interface SupplierPo {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  shipping: number;
  expected_at: string | null;
  received_at: string | null;
  created_at: string;
  notes: string | null;
  items: {
    id: string;
    product_id: string | null;
    sku: string;
    name: string;
    qty_ordered: number;
    qty_received: number;
    unit_cost: number;
  }[];
}

export interface SupplierProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  stock_on_hand: number;
  unit_cost: number;
  selling_price: number;
  // profit metrics (from product_metrics after migration 0006)
  gross_profit_90d: number;
  gross_margin_pct: number;
  revenue_90d: number;
  inventory_turnover: number;
  abc_class: "A" | "B" | "C" | null;
}

export default async function SupplierDetailPage({
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

  const [
    { data: supplier },
    { data: products },
    { data: pos },
    { data: alerts },
    { data: productMetrics },
  ] = await Promise.all([
    supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("products")
      .select("id, sku, name, category, stock_on_hand, unit_cost, selling_price")
      .eq("supplier_id", id)
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("purchase_orders")
      .select(`
        id, order_number, status, total, subtotal, shipping,
        expected_at, received_at, created_at, notes,
        purchase_order_items ( id, product_id, sku, name, qty_ordered, qty_received, unit_cost )
      `)
      .eq("organization_id", orgId)
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("decision_alerts")
      .select("id, severity, title, summary, created_at, status")
      .eq("organization_id", orgId)
      .eq("related_supplier_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("product_metrics")
      .select("product_id, gross_profit_90d, gross_margin_pct, revenue_90d, inventory_turnover, abc_class")
      .eq("organization_id", orgId),
  ]);

  if (!supplier) notFound();

  // Org-wide received POs for lead time comparison and spend totals
  const twelveMonthsAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data: orgReceivedPos } = await supabase
    .from("purchase_orders")
    .select("supplier_id, total, created_at, received_at")
    .eq("organization_id", orgId)
    .eq("status", "received")
    .not("received_at", "is", null)
    .gte("created_at", twelveMonthsAgo);

  const normalizedPos: SupplierPo[] = (pos ?? []).map((po) => {
    const rawItems = po.purchase_order_items;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    return {
      id: po.id as string,
      order_number: po.order_number as string,
      status: po.status as string,
      total: po.total as number,
      subtotal: po.subtotal as number,
      shipping: po.shipping as number,
      expected_at: po.expected_at as string | null,
      received_at: po.received_at as string | null,
      created_at: po.created_at as string,
      notes: po.notes as string | null,
      items: items.map((item) => ({
        id: item.id as string,
        product_id: item.product_id as string | null,
        sku: item.sku as string,
        name: item.name as string,
        qty_ordered: item.qty_ordered as number,
        qty_received: item.qty_received as number,
        unit_cost: item.unit_cost as number,
      })),
    };
  });

  const metricsMap = new Map(
    (productMetrics ?? []).map((m) => [m.product_id as string, m])
  );

  const supplierProducts: SupplierProduct[] = (products ?? []).map((p) => {
    const m = metricsMap.get(p.id as string);
    return {
      id: p.id as string,
      sku: p.sku as string,
      name: p.name as string,
      category: p.category as string | null,
      stock_on_hand: p.stock_on_hand as number,
      unit_cost: p.unit_cost as number,
      selling_price: p.selling_price as number,
      gross_profit_90d: (m?.gross_profit_90d as number) ?? 0,
      gross_margin_pct: (m?.gross_margin_pct as number) ?? 0,
      revenue_90d: (m?.revenue_90d as number) ?? 0,
      inventory_turnover: (m?.inventory_turnover as number) ?? 0,
      abc_class: (m?.abc_class as "A" | "B" | "C" | null) ?? null,
    };
  });

  // Build economic analysis data
  const orgRevenue90d = (productMetrics ?? []).reduce(
    (s, m) => s + ((m.revenue_90d as number) ?? 0),
    0
  );
  const orgAbcACount = (productMetrics ?? []).filter(
    (m) => (m.abc_class as string | null) === "A"
  ).length;

  const orgReceivedPosArr = orgReceivedPos ?? [];
  const orgLeadTimeDays = orgReceivedPosArr
    .filter((po) => po.supplier_id !== id && po.received_at)
    .map((po) =>
      Math.round(
        (new Date(po.received_at as string).getTime() -
          new Date(po.created_at as string).getTime()) /
          86400000
      )
    );
  const orgTotalPoSpend12m = orgReceivedPosArr.reduce(
    (s, po) => s + ((po.total as number) ?? 0),
    0
  );
  const supplierPoSpend12m = orgReceivedPosArr
    .filter((po) => po.supplier_id === id)
    .reduce((s, po) => s + ((po.total as number) ?? 0), 0);

  const economicData: SupplierEconomicData = {
    orgRevenue90d,
    orgLeadTimeDays,
    orgTotalPoSpend12m,
    supplierPoSpend12m,
    orgAbcACount,
  };

  return (
    <SupplierDetailClient
      supplier={supplier as Supplier}
      products={supplierProducts}
      pos={normalizedPos}
      alerts={(alerts ?? []).map((a) => ({
        id: a.id as string,
        severity: a.severity as string,
        title: a.title as string,
        summary: a.summary as string,
        created_at: a.created_at as string,
        status: a.status as string,
      }))}
      economicData={economicData}
    />
  );
}

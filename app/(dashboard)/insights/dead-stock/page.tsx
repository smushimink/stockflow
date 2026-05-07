import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { DeadStockClient } from "@/components/insights/dead-stock-client";

export const dynamic = "force-dynamic";

export interface DeadProduct {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  abcClass: string | null;
  stockOnHand: number;
  unitCost: number;
  sellingPrice: number;
  cashTiedUp: number;
  daysSinceLastSale: number | null;
  severity: "red" | "orange" | "yellow";
}

export default async function DeadStockPage() {
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

  const [{ data: products }, { data: metrics }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, name, category, abc_class, stock_on_hand, unit_cost, selling_price")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .gt("stock_on_hand", 0)
      .order("name"),
    supabase
      .from("product_metrics")
      .select("product_id, days_since_last_sale, cash_tied_up")
      .eq("organization_id", orgId),
  ]);

  const allProducts = products ?? [];
  const hasMetrics = (metrics ?? []).length > 0;
  const metricsMap = new Map((metrics ?? []).map((m) => [m.product_id as string, m]));

  let deadProducts: DeadProduct[] = [];

  function severityFor(days: number | null): "red" | "orange" | "yellow" {
    if (days === null || days >= 180) return "red";
    if (days >= 90) return "orange";
    return "yellow";
  }

  if (hasMetrics) {
    for (const p of allProducts) {
      const m = metricsMap.get(p.id as string);
      const days = m ? (m.days_since_last_sale as number | null) : null;
      if (days !== null && days < 60) continue; // below threshold
      deadProducts.push({
        id: p.id as string,
        sku: p.sku as string,
        name: p.name as string,
        category: (p.category as string | null) ?? null,
        abcClass: (p.abc_class as string | null) ?? null,
        stockOnHand: p.stock_on_hand as number,
        unitCost: p.unit_cost as number,
        sellingPrice: p.selling_price as number,
        cashTiedUp: m ? (m.cash_tied_up as number) : (p.stock_on_hand as number) * (p.unit_cost as number),
        daysSinceLastSale: days,
        severity: severityFor(days),
      });
    }
  } else {
    // Fallback: compute from sales order history
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: recentOrders } = await supabase
      .from("sales_orders")
      .select("ordered_at, sales_order_items ( product_id )")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("ordered_at", ninetyDaysAgo);

    const recentIds = new Set<string>();
    for (const order of recentOrders ?? []) {
      const items = Array.isArray(order.sales_order_items) ? order.sales_order_items : order.sales_order_items ? [order.sales_order_items] : [];
      for (const item of items) {
        const pid = (item as { product_id: string | null }).product_id;
        if (pid) recentIds.add(pid);
      }
    }

    // Get last sale date for dead products
    const deadProductIds = allProducts.filter((p) => !recentIds.has(p.id as string)).map((p) => p.id as string);

    const lastSaleMap = new Map<string, number | null>();
    for (const pid of deadProductIds) {
      const { data: lastOrder } = await supabase
        .from("sales_orders")
        .select("ordered_at, sales_order_items!inner ( product_id )")
        .eq("organization_id", orgId)
        .eq("status", "completed")
        .eq("sales_order_items.product_id", pid)
        .order("ordered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const days = lastOrder
        ? Math.floor((Date.now() - new Date(lastOrder.ordered_at as string).getTime()) / 86400000)
        : null;
      lastSaleMap.set(pid, days);
    }

    for (const p of allProducts) {
      if (recentIds.has(p.id as string)) continue;
      const days = lastSaleMap.get(p.id as string) ?? null;
      deadProducts.push({
        id: p.id as string,
        sku: p.sku as string,
        name: p.name as string,
        category: (p.category as string | null) ?? null,
        abcClass: (p.abc_class as string | null) ?? null,
        stockOnHand: p.stock_on_hand as number,
        unitCost: p.unit_cost as number,
        sellingPrice: p.selling_price as number,
        cashTiedUp: (p.stock_on_hand as number) * (p.unit_cost as number),
        daysSinceLastSale: days,
        severity: severityFor(days),
      });
    }
  }

  // Sort: red first, then by cash tied up DESC
  deadProducts.sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2 };
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    return b.cashTiedUp - a.cashTiedUp;
  });

  return (
    <DeadStockClient products={deadProducts} hasMetrics={hasMetrics} />
  );
}

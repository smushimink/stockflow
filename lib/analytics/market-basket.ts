/**
 * Market basket analysis — Apriori association rules.
 *
 * For each directed rule A → B:
 *   support    = P(A ∩ B)   — fraction of orders containing both
 *   confidence = P(B | A)   — fraction of A orders that also have B
 *   lift       = confidence / P(B)  — >1 means positive association
 *
 * Only considers completed/delivered orders.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface AssociationRule {
  product_a_id: string;
  product_b_id: string;
  product_a_sku: string;
  product_b_sku: string;
  product_a_name: string;
  product_b_name: string;
  support: number;
  confidence: number;
  lift: number;
  co_count: number;
  total_orders: number;
  insight: string;
}

export interface MarketBasketResult {
  rules: AssociationRule[];
  total_orders: number;
  eligible_products: number;
  insufficient_data: boolean;
  message?: string;
}

function buildInsight(
  skuA: string,
  skuB: string,
  confidence: number,
  lift: number,
  coCount: number
): string {
  const pct = (confidence * 100).toFixed(0);
  const liftStr = lift.toFixed(1);
  if (lift >= 3) {
    return `Customers who buy ${skuA} almost always pick up ${skuB} — ${pct}% of the time, ${liftStr}× more than random. Strong bundle candidate.`;
  }
  if (lift >= 2) {
    return `${pct}% of ${skuA} orders include ${skuB} (${liftStr}× above random). Appears in ${coCount} shared orders.`;
  }
  return `${skuA} buyers choose ${skuB} ${pct}% of the time (${liftStr}× lift, ${coCount} co-orders).`;
}

export async function findProductAssociations(
  orgId: string,
  minSupport = 0.02,
  minConfidence = 0.4
): Promise<MarketBasketResult> {
  const supabase = createAdminClient();

  // Fetch all completed orders with their product IDs
  const { data: orders, error } = await supabase
    .from("sales_orders")
    .select("id, sales_order_items(product_id)")
    .eq("organization_id", orgId)
    .in("status", ["completed", "delivered"]);

  if (error) throw error;

  const totalOrders = orders?.length ?? 0;
  if (totalOrders < 20) {
    return {
      rules: [],
      total_orders: totalOrders,
      eligible_products: 0,
      insufficient_data: true,
      message: `Need at least 20 completed orders — found ${totalOrders}.`,
    };
  }

  // Build inverted index: product_id → Set<order_id>
  const ordersByProduct = new Map<string, Set<string>>();

  for (const order of orders ?? []) {
    const items = Array.isArray(order.sales_order_items)
      ? order.sales_order_items
      : order.sales_order_items
      ? [order.sales_order_items]
      : [];

    const seenInOrder = new Set<string>();
    for (const item of items) {
      const pid = item.product_id as string | null;
      if (!pid || seenInOrder.has(pid)) continue;
      seenInOrder.add(pid);
      if (!ordersByProduct.has(pid)) ordersByProduct.set(pid, new Set());
      ordersByProduct.get(pid)!.add(order.id as string);
    }
  }

  // Only keep items appearing in ≥ minSupport fraction of orders
  const eligible = [...ordersByProduct.entries()].filter(
    ([, set]) => set.size / totalOrders >= minSupport
  );

  if (eligible.length < 2) {
    return {
      rules: [],
      total_orders: totalOrders,
      eligible_products: eligible.length,
      insufficient_data: true,
      message: `Only ${eligible.length} product(s) meet the minimum support threshold of ${(minSupport * 100).toFixed(0)}%. Lower minSupport or accumulate more orders.`,
    };
  }

  // Fetch product details for eligible products
  const eligibleIds = eligible.map(([id]) => id);
  const { data: productDetails } = await supabase
    .from("products")
    .select("id, sku, name, selling_price")
    .in("id", eligibleIds);

  const productMap = new Map(
    (productDetails ?? []).map((p) => [p.id as string, p])
  );

  // Compute pairwise association rules
  const rules: AssociationRule[] = [];

  for (let i = 0; i < eligible.length; i++) {
    const [aId, aOrders] = eligible[i];
    const pA = productMap.get(aId);
    if (!pA) continue;

    for (let j = i + 1; j < eligible.length; j++) {
      const [bId, bOrders] = eligible[j];
      const pB = productMap.get(bId);
      if (!pB) continue;

      // Count intersection efficiently (iterate smaller set)
      const [smaller, larger] =
        aOrders.size <= bOrders.size ? [aOrders, bOrders] : [bOrders, aOrders];
      let coCount = 0;
      for (const oid of smaller) {
        if (larger.has(oid)) coCount++;
      }

      if (coCount === 0) continue;

      const support = coCount / totalOrders;
      if (support < minSupport) continue;

      const lift = (coCount * totalOrders) / (aOrders.size * bOrders.size);
      const confidenceAB = coCount / aOrders.size;
      const confidenceBA = coCount / bOrders.size;

      const skuA = pA.sku as string;
      const skuB = pB.sku as string;
      const nameA = pA.name as string;
      const nameB = pB.name as string;

      if (confidenceAB >= minConfidence) {
        rules.push({
          product_a_id: aId,
          product_b_id: bId,
          product_a_sku: skuA,
          product_b_sku: skuB,
          product_a_name: nameA,
          product_b_name: nameB,
          support,
          confidence: confidenceAB,
          lift,
          co_count: coCount,
          total_orders: totalOrders,
          insight: buildInsight(skuA, skuB, confidenceAB, lift, coCount),
        });
      }

      if (confidenceBA >= minConfidence) {
        rules.push({
          product_a_id: bId,
          product_b_id: aId,
          product_a_sku: skuB,
          product_b_sku: skuA,
          product_a_name: nameB,
          product_b_name: nameA,
          support,
          confidence: confidenceBA,
          lift,
          co_count: coCount,
          total_orders: totalOrders,
          insight: buildInsight(skuB, skuA, confidenceBA, lift, coCount),
        });
      }
    }
  }

  rules.sort((a, b) => b.lift - a.lift);

  return {
    rules,
    total_orders: totalOrders,
    eligible_products: eligible.length,
    insufficient_data: false,
  };
}

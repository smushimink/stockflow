/**
 * ABC-XYZ classification — the wholesale industry standard.
 *
 * ABC = contribution to gross profit (Pareto):
 *   A → top 80% of org gross profit
 *   B → next 15%
 *   C → remaining 5%
 *
 * XYZ = demand variability (coefficient of variation of weekly sales, 26 weeks):
 *   X → CV < 0.5   (stable, predictable)
 *   Y → CV 0.5–1.0 (moderate variability)
 *   Z → CV > 1.0   (erratic)
 *
 * Requires: products, product_metrics, sales_order_items (last 26 weeks).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { mean, stdDev, coefficientOfVariation } from "./statistics";

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";
export type AbcXyzClass =
  | "AX" | "AY" | "AZ"
  | "BX" | "BY" | "BZ"
  | "CX" | "CY" | "CZ";

export interface AbcXyzResult {
  product_id: string;
  sku: string;
  name: string;
  category: string | null;
  abc_class: AbcClass;
  xyz_class: XyzClass;
  combined_class: AbcXyzClass;
  gross_profit_90d: number;
  weekly_avg_units: number;
  cv: number;                    // coefficient of variation
  recommended_strategy: string;
  weeks_with_data: number;       // out of 26
}

export const ABC_XYZ_STRATEGIES: Record<AbcXyzClass, string> = {
  AX: "Automate replenishment — tight reorder rules, never stock out, negotiate preferred lead times",
  AY: "Maintain safety buffer — high-value demand fluctuates, manual review monthly, dual sourcing worth it",
  AZ: "Forecast carefully — high profit but erratic demand; consider supplier backup, avoid over-ordering",
  BX: "Standard automation — stable mid-tier, set-and-forget reorder rules, batch review quarterly",
  BY: "Seasonal batching — order ahead of known demand cycles, standard safety stock",
  BZ: "Reduce exposure — order in smaller quantities, review stock levels quarterly",
  CX: "Lean stock — predictable but low-profit; minimise capital tied up, slow reorder cycles",
  CY: "Discontinue candidate — low profit with variable demand; consider dropping unless strategic",
  CZ: "Liquidate or discontinue — low profit, erratic demand; clear stock and review listing",
};

const ABC_XYZ_PRIORITY: Record<AbcXyzClass, number> = {
  AX: 1, AY: 2, AZ: 3, BX: 4, BY: 5, BZ: 6, CX: 7, CY: 8, CZ: 9,
};

export function abcXyzPriority(cls: AbcXyzClass): number {
  return ABC_XYZ_PRIORITY[cls] ?? 9;
}

/** Classify XYZ based on CV. CV = stdDev / mean over 26 weekly buckets. */
function classifyXyz(cv: number, weeksWithData: number): XyzClass {
  if (weeksWithData < 4) return "Z"; // insufficient history → treat as erratic
  if (cv < 0.5) return "X";
  if (cv < 1.0) return "Y";
  return "Z";
}

/** Classify ABC from sorted cumulative gross profit share. */
function classifyAbc(cumulativeShare: number): AbcClass {
  if (cumulativeShare <= 0.80) return "A";
  if (cumulativeShare <= 0.95) return "B";
  return "C";
}

export async function classifyAbcXyz(orgId: string): Promise<AbcXyzResult[]> {
  const supabase = createAdminClient();

  // ── Gross profit per product (90d) ───────────────────────────────────────
  const { data: metrics } = await supabase
    .from("product_metrics")
    .select("product_id, revenue_90d, real_margin_pct, abc_class")
    .eq("organization_id", orgId);

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, category, abc_class, selling_price, unit_cost")
    .eq("organization_id", orgId)
    .eq("status", "active");

  if (!products?.length) return [];

  const metricsMap = new Map((metrics ?? []).map((m) => [m.product_id as string, m]));

  // Build gross profit per product
  const gpMap = new Map<string, number>();
  for (const p of products) {
    const m = metricsMap.get(p.id as string);
    const revenue = (m?.revenue_90d as number) ?? 0;
    const margin = (m?.real_margin_pct as number) ?? 0;
    gpMap.set(p.id as string, revenue * margin);
  }

  // Sort products by gross profit descending for Pareto
  const sorted = [...products].sort(
    (a, b) => (gpMap.get(b.id as string) ?? 0) - (gpMap.get(a.id as string) ?? 0)
  );

  const totalGp = sorted.reduce((s, p) => s + (gpMap.get(p.id as string) ?? 0), 0);

  // ── Weekly sales per product (26 weeks) ───────────────────────────────────
  const since26w = new Date(Date.now() - 26 * 7 * 24 * 3600 * 1000).toISOString();

  const { data: salesItems } = await supabase
    .from("sales_order_items")
    .select(`
      product_id, qty,
      sales_orders!inner ( ordered_at, status )
    `)
    .eq("organization_id", orgId)
    .gte("sales_orders.ordered_at", since26w)
    .eq("sales_orders.status", "completed")
    .not("product_id", "is", null);

  // Bucket into week-of-year per product
  type WeekKey = string; // "productId::YYYY-WW"
  const weekBuckets = new Map<WeekKey, number>();

  for (const item of salesItems ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = Array.isArray(item.sales_orders) ? (item.sales_orders as any[])[0] : item.sales_orders;
    if (!order?.ordered_at) continue;
    const d = new Date(order.ordered_at as string);
    const year = d.getFullYear();
    const week = Math.floor((d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 3600 * 1000));
    const key: WeekKey = `${item.product_id as string}::${year}-${week}`;
    weekBuckets.set(key, (weekBuckets.get(key) ?? 0) + (item.qty as number));
  }

  // Aggregate to per-product weekly arrays
  const weeklyByProduct = new Map<string, number[]>();
  for (const [key, qty] of weekBuckets.entries()) {
    const pid = key.split("::")[0];
    if (!weeklyByProduct.has(pid)) weeklyByProduct.set(pid, []);
    weeklyByProduct.get(pid)!.push(qty);
  }

  // ── Build results ─────────────────────────────────────────────────────────
  let cumGp = 0;
  const results: AbcXyzResult[] = [];

  for (const product of sorted) {
    const pid = product.id as string;
    const gp = gpMap.get(pid) ?? 0;
    cumGp += gp;
    const cumulativeShare = totalGp > 0 ? cumGp / totalGp : 1;
    const abc = classifyAbc(cumulativeShare);

    const weeksWithSales = weeklyByProduct.get(pid) ?? [];
    const weeksWithData = weeksWithSales.length;

    // Fill missing weeks with 0 up to 26 total observations
    const fullWeeks = [...weeksWithSales, ...new Array(Math.max(0, 26 - weeksWithData)).fill(0)];
    const cv = mean(fullWeeks) > 0 ? coefficientOfVariation(fullWeeks) : 2; // no sales → highly variable
    const weeklyAvg = mean(fullWeeks);

    const xyz = classifyXyz(cv, weeksWithData);
    const combined = `${abc}${xyz}` as AbcXyzClass;

    results.push({
      product_id: pid,
      sku: product.sku as string,
      name: product.name as string,
      category: product.category as string | null,
      abc_class: abc,
      xyz_class: xyz,
      combined_class: combined,
      gross_profit_90d: Math.round(gp * 100) / 100,
      weekly_avg_units: Math.round(weeklyAvg * 10) / 10,
      cv: Math.round(cv * 100) / 100,
      recommended_strategy: ABC_XYZ_STRATEGIES[combined],
      weeks_with_data: weeksWithData,
    });
  }

  return results;
}

/** Write ABC-XYZ classification back to products and product_metrics tables. */
export async function persistAbcXyz(
  orgId: string,
  results: AbcXyzResult[]
): Promise<{ updated: number }> {
  const supabase = createAdminClient();
  let updated = 0;

  // Batch upserts in groups of 50
  const BATCH = 50;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);

    const productUpdates = batch.map((r) => ({
      id: r.product_id,
      abc_class: r.abc_class,
      xyz_class: r.xyz_class,
      abc_xyz_class: r.combined_class,
    }));

    // Update products table
    await Promise.all(
      productUpdates.map((upd) =>
        supabase
          .from("products")
          .update({ abc_class: upd.abc_class, xyz_class: upd.xyz_class, abc_xyz_class: upd.abc_xyz_class })
          .eq("id", upd.id)
          .eq("organization_id", orgId)
      )
    );

    // Update product_metrics table
    await Promise.all(
      productUpdates.map((upd) =>
        supabase
          .from("product_metrics")
          .update({ abc_class: upd.abc_class, xyz_class: upd.xyz_class, abc_xyz_class: upd.abc_xyz_class })
          .eq("product_id", upd.id)
          .eq("organization_id", orgId)
      )
    );

    updated += batch.length;
  }

  return { updated };
}

/** Single entry point: classify + persist. Returns the results. */
export async function recalculateAbcXyz(orgId: string): Promise<AbcXyzResult[]> {
  const results = await classifyAbcXyz(orgId);
  if (results.length > 0) await persistAbcXyz(orgId, results);
  return results;
}

/** Summarise results into a 9-cell matrix: AbcXyzClass → product count */
export function buildAbcXyzMatrix(results: AbcXyzResult[]): Record<AbcXyzClass, number> {
  const matrix: Record<AbcXyzClass, number> = {
    AX: 0, AY: 0, AZ: 0, BX: 0, BY: 0, BZ: 0, CX: 0, CY: 0, CZ: 0,
  };
  for (const r of results) matrix[r.combined_class]++;
  return matrix;
}

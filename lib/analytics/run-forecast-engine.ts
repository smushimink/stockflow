import { createAdminClient } from "@/lib/supabase/admin";
import {
  fitNegativeBinomial,
  leadTimeDemandDistribution,
  newsvendorOptimalStock,
  calculateProbabilisticROP,
  type DailyDemand,
} from "./forecast";

export interface ForecastEngineResult {
  org_id: string;
  products_processed: number;
  products_skipped: number;
  duration_ms: number;
  pattern_counts: Record<string, number>;
  errors: string[];
}

export async function runForecastEngine(orgId: string): Promise<ForecastEngineResult> {
  const t0 = Date.now();
  const supabase = createAdminClient();
  const errors: string[] = [];
  const pattern_counts: Record<string, number> = {};
  let products_processed = 0;
  let products_skipped = 0;

  // ── 1. Load all active products with metrics and cost ─────────────────────

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(`
      id, sku, name, unit_cost, selling_price, stock_on_hand,
      lead_time_days, moq,
      suppliers ( lead_time_days ),
      product_metrics ( avg_daily_sales_30d, avg_daily_sales_90d )
    `)
    .eq("organization_id", orgId)
    .eq("status", "active");

  if (prodErr || !products) {
    return { org_id: orgId, products_processed: 0, products_skipped: 0, duration_ms: Date.now() - t0, pattern_counts: {}, errors: [prodErr?.message ?? "Failed to load products"] };
  }

  // ── 2. Load 365 days of daily sales for this org ──────────────────────────

  const since = new Date();
  since.setDate(since.getDate() - 365);

  const { data: salesRows, error: salesErr } = await supabase
    .from("sales_order_items")
    .select("product_id, qty, sales_orders!inner(ordered_at, status)")
    .eq("organization_id", orgId)
    .eq("sales_orders.status", "completed")
    .gte("sales_orders.ordered_at", since.toISOString());

  if (salesErr) {
    errors.push(`Sales query failed: ${salesErr.message}`);
    return { org_id: orgId, products_processed: 0, products_skipped: 0, duration_ms: Date.now() - t0, pattern_counts: {}, errors };
  }

  // ── 3. Build a per-product daily sales map ────────────────────────────────

  // product_id → date string → qty
  const salesByProductDate = new Map<string, Map<string, number>>();
  for (const row of salesRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderedAt = (row.sales_orders as any)?.ordered_at as string | undefined;
    if (!orderedAt) continue;
    const dateStr = orderedAt.slice(0, 10);
    const pid = row.product_id as string;
    if (!salesByProductDate.has(pid)) salesByProductDate.set(pid, new Map());
    const dayMap = salesByProductDate.get(pid)!;
    dayMap.set(dateStr, (dayMap.get(dateStr) ?? 0) + (row.qty as number));
  }

  // ── 4. Process each product ───────────────────────────────────────────────

  const upserts: Record<string, unknown>[] = [];

  for (const product of products) {
    try {
      const pid = product.id as string;

      // Build daily demand series (last 365 days)
      const days: DailyDemand[] = [];
      const dayMap = salesByProductDate.get(pid);
      const stockOnHand = product.stock_on_hand as number;
      const currentlyStockedOut = stockOnHand <= 0;

      for (let d = 364; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().slice(0, 10);
        const qty = dayMap?.get(dateStr) ?? 0;
        // Flag recent zero-demand days as censored if currently stocked out
        // (conservative: only last 30 days when stocked out)
        const stocked_out = currentlyStockedOut && d <= 30 && qty === 0;
        days.push({ qty, stocked_out });
      }

      // Fit model
      const fit = fitNegativeBinomial(days);

      if (fit.warning === 'sparse_data' || fit.fit_quality === 0) {
        products_skipped++;
        upserts.push({
          organization_id: orgId,
          product_id: pid,
          lambda: null,
          k: null,
          fit_quality: 0,
          demand_pattern: fit.demand_pattern,
          lead_time_days_used: null,
          ltd_mean: null,
          ltd_stddev: null,
          ltd_p50: null,
          ltd_p95: null,
          recommended_rop: null,
          recommended_target_stock: null,
          recommended_order_qty: null,
          service_level_used: null,
          critical_ratio: null,
          censored_days: fit.censored_days,
          data_points: fit.data_points,
          warning: fit.warning ?? 'sparse_data',
          calculated_at: new Date().toISOString(),
        });
        pattern_counts[fit.demand_pattern] = (pattern_counts[fit.demand_pattern] ?? 0) + 1;
        continue;
      }

      // Lead time
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supplierLt = (Array.isArray(product.suppliers) ? (product.suppliers as any[])[0] : product.suppliers)?.lead_time_days as number | undefined;
      const leadTime = (product.lead_time_days as number | null) ?? supplierLt ?? 14;

      // LTD distribution
      const ltd = leadTimeDemandDistribution(fit.lambda, fit.k, leadTime);

      // Newsvendor
      const sellingPrice = product.selling_price as number || 0;
      const unitCost = product.unit_cost as number || 0;
      const cu = Math.max(0.01, sellingPrice - unitCost); // lost gross profit
      const co = unitCost * (0.25 / 365) * leadTime;     // holding cost over lead time
      const nv = newsvendorOptimalStock(ltd, cu, co);

      // Service level ROP (95% default)
      const serviceLevel = 0.95;
      const { rop } = calculateProbabilisticROP(ltd, serviceLevel);

      const moq = (product.moq as number | null) ?? 1;
      const targetStock = Math.max(nv.optimal_stock, rop);
      const rawOrderQty = targetStock - Math.max(0, stockOnHand);
      const recommendedOrderQty = rawOrderQty > 0 ? Math.max(moq, rawOrderQty) : 0;

      pattern_counts[fit.demand_pattern] = (pattern_counts[fit.demand_pattern] ?? 0) + 1;
      products_processed++;

      upserts.push({
        organization_id: orgId,
        product_id: pid,
        lambda: fit.lambda,
        k: fit.k,
        fit_quality: fit.fit_quality,
        demand_pattern: fit.demand_pattern,
        lead_time_days_used: leadTime,
        ltd_mean: ltd.mean,
        ltd_stddev: ltd.std_dev,
        ltd_p50: ltd.p50,
        ltd_p95: ltd.p95,
        recommended_rop: rop,
        recommended_target_stock: targetStock,
        recommended_order_qty: recommendedOrderQty,
        service_level_used: serviceLevel,
        critical_ratio: nv.critical_ratio,
        censored_days: fit.censored_days,
        data_points: fit.data_points,
        warning: fit.warning ?? null,
        calculated_at: new Date().toISOString(),
      });
    } catch (e) {
      errors.push(`Product ${product.sku}: ${e instanceof Error ? e.message : String(e)}`);
      products_skipped++;
    }
  }

  // ── 5. Batch upsert ───────────────────────────────────────────────────────

  if (upserts.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < upserts.length; i += CHUNK) {
      const chunk = upserts.slice(i, i + CHUNK);
      const { error: upsertErr } = await supabase
        .from("product_forecasts")
        .upsert(chunk, { onConflict: "organization_id,product_id" });
      if (upsertErr) errors.push(`Upsert chunk ${i}: ${upsertErr.message}`);
    }
  }

  return {
    org_id: orgId,
    products_processed,
    products_skipped,
    duration_ms: Date.now() - t0,
    pattern_counts,
    errors,
  };
}

import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthIndex {
  month: number;      // 1–12
  multiplier: number; // sales index relative to annual average (1.0 = average)
}

export interface SeasonalityDetectionResult {
  status: "insufficient_data" | "success";
  dataMonths: number;
  minRequired: 12;
  patternsDetected: number;
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? 0 : num / denom;
}

// ── Core detection ────────────────────────────────────────────────────────────

export async function detectSeasonality(orgId: string): Promise<SeasonalityDetectionResult> {
  const supabase = createAdminClient();

  // Pull every completed sale for this org. We use !inner so we only
  // get items that have a parent order (filters out orphaned rows).
  const { data: rawItems, error } = await supabase
    .from("sales_order_items")
    .select("product_id, qty, sales_orders!inner(ordered_at, status)")
    .eq("organization_id", orgId)
    .not("product_id", "is", null);

  if (error) throw error;

  // ── Parse records ───────────────────────────────────────────────────────────

  type Rec = { productId: string; year: number; month: number };
  const records: Array<Rec & { qty: number }> = [];

  for (const item of rawItems ?? []) {
    const orderRaw = item.sales_orders;
    const order = (
      Array.isArray(orderRaw) ? orderRaw[0] : orderRaw
    ) as { ordered_at: string; status: string } | null;

    if (!order || order.status !== "completed") continue;

    const d = new Date(order.ordered_at);
    records.push({
      productId: item.product_id as string,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      qty: item.qty as number,
    });
  }

  // ── Gate: need data ─────────────────────────────────────────────────────────

  if (records.length === 0) {
    return {
      status: "insufficient_data",
      dataMonths: 0,
      minRequired: 12,
      patternsDetected: 0,
      message:
        "No sales data found. Seasonality detection requires at least 12 months of history.",
    };
  }

  // Compute org-level data span (linear month index for comparison)
  const linearMonths = records.map((r) => r.year * 12 + r.month);
  const dataMonths =
    Math.max(...linearMonths) - Math.min(...linearMonths) + 1;

  if (dataMonths < 12) {
    return {
      status: "insufficient_data",
      dataMonths,
      minRequired: 12,
      patternsDetected: 0,
      message: `Seasonality detection requires at least 12 months. Currently you have ${dataMonths} month${dataMonths !== 1 ? "s" : ""}. Patterns will improve over time.`,
    };
  }

  // ── Group by product → (year × 100 + month) → total qty ────────────────────
  // Using year*100+month as a compact key (e.g. 202301 for Jan 2023).

  const productData = new Map<string, Map<number, number>>();

  for (const r of records) {
    const ym = r.year * 100 + r.month;
    if (!productData.has(r.productId))
      productData.set(r.productId, new Map());
    const ymMap = productData.get(r.productId)!;
    ymMap.set(ym, (ymMap.get(ym) ?? 0) + r.qty);
  }

  // ── Compute patterns per product ────────────────────────────────────────────

  const patternsToInsert: Array<{
    organization_id: string;
    product_id: string;
    category: null;
    pattern_type: string;
    peak_periods: MonthIndex[];
    trough_periods: MonthIndex[];
    confidence: number;
    detected_at: string;
    manually_confirmed: false;
  }> = [];

  for (const [productId, ymMap] of productData) {
    // Check product-level span
    const productLinear = Array.from(ymMap.keys()).map(
      (ym) => Math.floor(ym / 100) * 12 + (ym % 100)
    );
    const productSpan =
      Math.max(...productLinear) - Math.min(...productLinear) + 1;

    if (productSpan < 12) continue; // not enough history for this product

    // Determine year range to build the monthly averages
    const years = [
      ...new Set(Array.from(ymMap.keys()).map((ym) => Math.floor(ym / 100))),
    ].sort();
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const yearCount = maxYear - minYear + 1;

    // Monthly totals across all years; denominator = yearCount so months with
    // 0 sales in some years pull the average down (as they should).
    const monthSums = new Array(12).fill(0);
    for (let month = 1; month <= 12; month++) {
      for (let year = minYear; year <= maxYear; year++) {
        monthSums[month - 1] += ymMap.get(year * 100 + month) ?? 0;
      }
    }
    const monthAvgs = monthSums.map((s) => s / yearCount);
    const overallAvg = monthAvgs.reduce((a, b) => a + b, 0) / 12;
    if (overallAvg === 0) continue;

    const allMonths: MonthIndex[] = monthAvgs.map((avg, i) => ({
      month: i + 1,
      multiplier: Math.round((avg / overallAvg) * 100) / 100,
    }));

    const troughMonths = allMonths.filter((m) => m.multiplier < 0.6);

    // Confidence: YoY Pearson if ≥ 2 full calendar years; else base rate of 0.4
    let confidence = 0.4;
    if (years.length >= 2) {
      const y1 = years[years.length - 2];
      const y2 = years[years.length - 1];
      const p1 = Array.from({ length: 12 }, (_, i) => ymMap.get(y1 * 100 + i + 1) ?? 0);
      const p2 = Array.from({ length: 12 }, (_, i) => ymMap.get(y2 * 100 + i + 1) ?? 0);
      confidence = Math.max(0.1, Math.min(1, pearsonCorrelation(p1, p2)));
    }

    patternsToInsert.push({
      organization_id: orgId,
      product_id: productId,
      category: null,
      pattern_type: "annual",
      peak_periods: allMonths,   // full 12-month shape
      trough_periods: troughMonths,
      confidence: Math.round(confidence * 100) / 100,
      detected_at: new Date().toISOString(),
      manually_confirmed: false,
    });
  }

  // ── Persist: replace all auto-detected, keep manually confirmed ─────────────

  await supabase
    .from("seasonality_patterns")
    .delete()
    .eq("organization_id", orgId)
    .eq("manually_confirmed", false);

  if (patternsToInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("seasonality_patterns")
      .insert(patternsToInsert);
    if (insertErr) throw insertErr;
  }

  return {
    status: "success",
    dataMonths,
    minRequired: 12,
    patternsDetected: patternsToInsert.length,
  };
}

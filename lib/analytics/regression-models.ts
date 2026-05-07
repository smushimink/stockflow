/**
 * Three pre-built regression models for wholesale business intelligence.
 * All use Ordinary Least Squares (OLS) via the normal equations.
 * Statistics are transparent — every coefficient, std error, and p-value
 * is exposed so the owner can audit and challenge the model.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { mean, stdDev, correlation } from "./statistics";

// ── OLS implementation ────────────────────────────────────────────────────────

// Matrix utilities (minimal, for n ≤ 20 features — never memory-heavy here)
function matMul(A: number[][], B: number[][]): number[][] {
  const [m, n, p] = [A.length, A[0].length, B[0].length];
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: p }, (_, j) =>
      Array.from({ length: n }, (_, k) => A[i][k] * B[k][j]).reduce((a, b) => a + b, 0)
    )
  );
}

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
}

/** Gauss–Jordan elimination with partial pivoting. Returns β or empty on failure. */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) return [];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / pivot;
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
  }

  return M.map((row) => row[n]);
}

/** Approximate normal CDF (Abramowitz & Stegun 26.2.17). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

function twoTailedP(tStat: number): number {
  return 2 * (1 - normalCdf(Math.abs(tStat)));
}

interface OlsResult {
  coefficients: number[];
  residuals: number[];
  r2: number;
  stdErrors: number[];
  pValues: number[];
}

function ols(X: number[][], y: number[]): OlsResult | null {
  const n = X.length;
  const k = X[0].length;
  if (n < k + 1) return null;

  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matVecMul(Xt, y);
  const beta = solveLinearSystem(XtX, Xty);
  if (beta.length === 0) return null;

  const predictions = X.map((row) => row.reduce((s, x, j) => s + x * beta[j], 0));
  const residuals = y.map((yi, i) => yi - predictions[i]);

  const yMean = mean(y);
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const ssRes = residuals.reduce((s, r) => s + r ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Residual variance (MSE)
  const df = n - k;
  const sigma2 = df > 0 ? ssRes / df : 0;

  // Variance of beta: diag((X'X)^{-1}) * sigma²
  // We need (X'X)^{-1}. Compute by solving X'X * e_j = I columns.
  const XtXinv_diag: number[] = [];
  for (let j = 0; j < k; j++) {
    const ej = Array.from({ length: k }, (_, i) => (i === j ? 1 : 0));
    const col = solveLinearSystem(XtX, ej);
    XtXinv_diag.push(col.length ? col[j] : 0);
  }

  const stdErrors = XtXinv_diag.map((v) => Math.sqrt(Math.max(0, v * sigma2)));
  const pValues = beta.map((b, j) => {
    const se = stdErrors[j];
    if (se <= 0) return 1;
    return twoTailedP(b / se);
  });

  return { coefficients: beta, residuals, r2, stdErrors, pValues };
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  std_error: number;
  p_value: number;
  significant: boolean; // p < 0.05
  interpretation: string;
}

// ── Model 1: Sales drivers ────────────────────────────────────────────────────

export interface SalesDriversResult {
  formula: string;
  observations: number;
  coefficients: RegressionCoefficient[];
  r_squared: number;
  insights: string[];
  insufficient_data: boolean;
  message?: string;
}

export async function runSalesDriverRegression(
  orgId: string,
  productIds?: string[],
  periodDays = 90
): Promise<SalesDriversResult> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString();

  let query = supabase
    .from("sales_order_items")
    .select(`
      qty, unit_price, discount,
      sales_orders!inner ( ordered_at, status )
    `)
    .gte("sales_orders.ordered_at", since)
    .eq("sales_orders.status", "completed")
    .eq("organization_id", orgId);

  if (productIds?.length) {
    query = query.in("product_id", productIds);
  }

  const { data: items } = await query;

  if (!items?.length || items.length < 30) {
    return {
      formula: "—",
      observations: items?.length ?? 0,
      coefficients: [],
      r_squared: 0,
      insights: [],
      insufficient_data: true,
      message: `Need at least 30 observations — found ${items?.length ?? 0} across ${periodDays} days.`,
    };
  }

  // Build features per day
  type Row = { qty: number; discountPct: number; isWeekend: number; month: number; price: number };
  const rows: Row[] = [];

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = Array.isArray(item.sales_orders) ? (item.sales_orders as any[])[0] : item.sales_orders;
    if (!order?.ordered_at) continue;

    const date = new Date(order.ordered_at as string);
    const dow = date.getDay();
    const unitPrice = item.unit_price as number;
    const discount = item.discount as number;

    rows.push({
      qty: item.qty as number,
      discountPct: unitPrice > 0 ? discount / unitPrice : 0,
      isWeekend: dow === 0 || dow === 6 ? 1 : 0,
      month: date.getMonth() + 1, // 1-12
      price: unitPrice - discount,
    });
  }

  if (rows.length < 30) {
    return { formula: "—", observations: rows.length, coefficients: [], r_squared: 0, insights: [], insufficient_data: true, message: "Insufficient usable rows after filtering." };
  }

  const y = rows.map((r) => r.qty);
  const varNames = ["intercept", "discount_%", "is_weekend", "month", "price"];
  const X = rows.map((r) => [1, r.discountPct, r.isWeekend, r.month, r.price]);

  const result = ols(X, y);
  if (!result) {
    return { formula: "—", observations: rows.length, coefficients: [], r_squared: 0, insights: [], insufficient_data: true, message: "OLS failed — possible multicollinearity." };
  }

  const avgQty = mean(y);
  const coefficients: RegressionCoefficient[] = result.coefficients.map((c, i) => {
    const interpretation = buildSalesCoeffInterpretation(varNames[i], c, avgQty);
    return {
      variable: varNames[i],
      coefficient: Math.round(c * 10000) / 10000,
      std_error: Math.round(result.stdErrors[i] * 10000) / 10000,
      p_value: Math.round(result.pValues[i] * 10000) / 10000,
      significant: result.pValues[i] < 0.05,
      interpretation,
    };
  });

  const sigCoeffs = coefficients.filter((c) => c.significant && c.variable !== "intercept");
  const insights = buildSalesInsights(sigCoeffs, avgQty);

  return {
    formula: `qty ~ ${varNames.slice(1).join(" + ")}`,
    observations: rows.length,
    coefficients,
    r_squared: Math.round(result.r2 * 1000) / 1000,
    insights,
    insufficient_data: false,
  };
}

function buildSalesCoeffInterpretation(variable: string, coeff: number, avgQty: number): string {
  const pct = avgQty > 0 ? Math.abs((coeff / avgQty) * 100).toFixed(0) : "?";
  switch (variable) {
    case "discount_%":
      return coeff > 0
        ? `A 10% discount increases units sold by ~${(coeff * 10 / avgQty * 100).toFixed(0)}%`
        : `Higher discounts correlate with lower volume (possible quality signal)`;
    case "is_weekend":
      return coeff > 0
        ? `Weekend orders average ${Math.abs(coeff).toFixed(1)} more units`
        : `Weekdays average ${Math.abs(coeff).toFixed(1)} more units per order than weekends`;
    case "month":
      return coeff > 0
        ? `Volume trends +${coeff.toFixed(2)} units/month through the year (seasonal growth)`
        : `Volume trends ${coeff.toFixed(2)} units/month through the year`;
    case "price":
      return coeff < 0
        ? `Each $1 increase in price reduces qty by ${Math.abs(coeff).toFixed(2)} units`
        : `Positive price-volume relationship detected (possible Giffen or quality effect)`;
    case "intercept":
      return `Baseline: ${coeff.toFixed(1)} units when all factors are zero`;
    default:
      return `Effect: ${coeff > 0 ? "+" : ""}${coeff.toFixed(3)} units (${pct}% of avg)`;
  }
}

function buildSalesInsights(sigCoeffs: RegressionCoefficient[], avgQty: number): string[] {
  const insights: string[] = [];
  const discount = sigCoeffs.find((c) => c.variable === "discount_%");
  const weekend = sigCoeffs.find((c) => c.variable === "is_weekend");
  const price = sigCoeffs.find((c) => c.variable === "price");

  if (discount && discount.coefficient > 0) {
    insights.push(`Discounting is effective: a 10% discount lifts volume by ~${(discount.coefficient * 10 / avgQty * 100).toFixed(0)}%`);
  } else if (discount && discount.coefficient < 0) {
    insights.push(`Discounting shows negative correlation with volume — customers may perceive discounts as quality signals`);
  }
  if (weekend) {
    insights.push(weekend.coefficient > 0
      ? `Weekend sales average higher volume — consider weekend-specific promotions`
      : `Weekday orders dominate — schedule fulfilment and promotions for Mon–Fri`
    );
  }
  if (price) {
    insights.push(price.coefficient < 0
      ? `Price negatively affects volume — confirm with elasticity analysis for precise optimal pricing`
      : `Unusual: higher prices correlate with higher volume — possibly a premium product or limited data`
    );
  }
  if (insights.length === 0) insights.push("No statistically significant sales drivers found in this period — collect more data or adjust the analysis window.");
  return insights.slice(0, 3);
}

// ── Model 2: Customer CLV predictor ──────────────────────────────────────────

export interface ClvPredictorResult {
  features_used: string[];
  coefficients: RegressionCoefficient[];
  r_squared: number;
  segment_avg_clv: Array<{ segment: string; avg_clv: number; n: number }>;
  insights: string[];
  insufficient_data: boolean;
  message?: string;
}

export async function runCustomerClvRegression(orgId: string): Promise<ClvPredictorResult> {
  const supabase = createAdminClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, total_orders, total_spent, avg_order_interval_days, last_order_at, created_at")
    .eq("organization_id", orgId)
    .eq("active", true)
    .gte("total_orders", 2);

  if (!customers?.length || customers.length < 15) {
    return { features_used: [], coefficients: [], r_squared: 0, segment_avg_clv: [], insights: [], insufficient_data: true, message: `Need 15+ qualifying customers — found ${customers?.length ?? 0}.` };
  }

  const now = Date.now();
  const rows = customers.map((c) => {
    const daysAgo = c.created_at
      ? Math.floor((now - new Date(c.created_at as string).getTime()) / (24 * 3600 * 1000))
      : 365;
    const monthsActive = Math.max(1, daysAgo / 30);
    return {
      lifetime_value: c.total_spent as number,
      first_order_annualised: ((c.total_spent as number) / monthsActive) * 12,
      order_frequency: (c.total_orders as number) / Math.max(1, monthsActive),
      avg_interval_days: (c.avg_order_interval_days as number) ?? 90,
      total_orders: c.total_orders as number,
    };
  });

  const y = rows.map((r) => r.lifetime_value);
  const featureNames = ["intercept", "monthly_revenue_rate", "order_frequency", "avg_interval_days"];
  const X = rows.map((r) => [1, r.first_order_annualised / 12, r.order_frequency, r.avg_interval_days]);

  const result = ols(X, y);
  if (!result) {
    return { features_used: featureNames.slice(1), coefficients: [], r_squared: 0, segment_avg_clv: [], insights: [], insufficient_data: true, message: "OLS failed." };
  }

  const avgClv = mean(y);
  const coefficients: RegressionCoefficient[] = result.coefficients.map((c, i) => ({
    variable: featureNames[i],
    coefficient: Math.round(c * 100) / 100,
    std_error: Math.round(result.stdErrors[i] * 100) / 100,
    p_value: Math.round(result.pValues[i] * 10000) / 10000,
    significant: result.pValues[i] < 0.05,
    interpretation: buildClvInterpretation(featureNames[i], c, avgClv),
  }));

  // Segment by order frequency quartiles
  const freqValues = rows.map((r) => r.order_frequency);
  const lowFreq = mean(freqValues) - stdDev(freqValues);
  const hiFreq = mean(freqValues) + stdDev(freqValues);
  const segments = [
    { segment: "Low frequency", customers: rows.filter((r) => r.order_frequency < lowFreq) },
    { segment: "Medium frequency", customers: rows.filter((r) => r.order_frequency >= lowFreq && r.order_frequency <= hiFreq) },
    { segment: "High frequency", customers: rows.filter((r) => r.order_frequency > hiFreq) },
  ];
  const segment_avg_clv = segments.map(({ segment, customers: seg }) => ({
    segment,
    avg_clv: seg.length > 0 ? Math.round(mean(seg.map((r) => r.lifetime_value))) : 0,
    n: seg.length,
  }));

  const freqCoeff = coefficients.find((c) => c.variable === "order_frequency" && c.significant);
  const intervalCoeff = coefficients.find((c) => c.variable === "avg_interval_days" && c.significant);

  const insights: string[] = [];
  if (freqCoeff) insights.push(`Order frequency is the strongest CLV predictor: each additional order/month adds ~$${Math.abs(freqCoeff.coefficient).toFixed(0)} to lifetime value`);
  if (intervalCoeff && intervalCoeff.coefficient < 0) insights.push(`Customers who order more frequently (shorter intervals) generate ${Math.abs(intervalCoeff.coefficient).toFixed(0)} more lifetime value per day shorter interval`);
  if (segment_avg_clv.length > 0) {
    const best = segment_avg_clv.sort((a, b) => b.avg_clv - a.avg_clv)[0];
    insights.push(`"${best.segment}" customers average $${best.avg_clv.toLocaleString()} lifetime value — prioritise acquiring and retaining this segment`);
  }

  return { features_used: featureNames.slice(1), coefficients, r_squared: Math.round(result.r2 * 1000) / 1000, segment_avg_clv, insights: insights.slice(0, 3), insufficient_data: false };
}

function buildClvInterpretation(variable: string, coeff: number, avgClv: number): string {
  switch (variable) {
    case "monthly_revenue_rate": return `Each $1/month of early revenue rate predicts $${coeff.toFixed(2)} additional lifetime value`;
    case "order_frequency": return `Each extra order per month predicts $${coeff.toFixed(0)} additional lifetime value`;
    case "avg_interval_days": return coeff < 0 ? `Each additional day between orders reduces lifetime value by $${Math.abs(coeff).toFixed(2)}` : `Longer order intervals correlate with higher value (possible bulk buyers)`;
    case "intercept": return `Baseline CLV for minimum-activity customers: $${coeff.toFixed(0)}`;
    default: return `Effect: $${coeff.toFixed(2)} per unit (${avgClv > 0 ? ((coeff / avgClv) * 100).toFixed(0) : "?"}% of avg)`;
  }
}

// ── Model 3: Lead-time accuracy ───────────────────────────────────────────────

export interface SupplierLeadTimeProfile {
  supplier_id: string;
  supplier_name: string;
  promised_lead_time: number;
  actual_avg: number;
  variability: number;          // residual std dev (days)
  seasonal_factor: number;      // correlation of lead time with month (−1..1)
  confidence_band_95: { lower: number; upper: number };
  sample_size: number;
  insight: string;
}

export interface LeadTimeModelResult {
  by_supplier: SupplierLeadTimeProfile[];
  insufficient_data: boolean;
  message?: string;
}

export async function runLeadTimeModel(orgId: string): Promise<LeadTimeModelResult> {
  const supabase = createAdminClient();

  const [{ data: suppliers }, { data: pos }] = await Promise.all([
    supabase.from("suppliers").select("id, name, lead_time_days").eq("organization_id", orgId).eq("active", true),
    supabase
      .from("purchase_orders")
      .select("supplier_id, status, created_at, received_at")
      .eq("organization_id", orgId)
      .eq("status", "received")
      .not("received_at", "is", null),
  ]);

  if (!pos?.length) {
    return { by_supplier: [], insufficient_data: true, message: "No received purchase orders found." };
  }

  const poBySupplier = new Map<string, typeof pos>();
  for (const po of pos) {
    const sid = po.supplier_id as string;
    if (!poBySupplier.has(sid)) poBySupplier.set(sid, []);
    poBySupplier.get(sid)!.push(po);
  }

  const profiles: SupplierLeadTimeProfile[] = [];

  for (const supplier of suppliers ?? []) {
    const supplierPos = poBySupplier.get(supplier.id as string) ?? [];
    if (supplierPos.length < 3) continue;

    const leadTimes = supplierPos
      .filter((po) => po.created_at && po.received_at)
      .map((po) => ({
        days: (new Date(po.received_at as string).getTime() - new Date(po.created_at as string).getTime()) / (24 * 3600 * 1000),
        month: new Date(po.created_at as string).getMonth() + 1,
      }));

    if (leadTimes.length < 3) continue;

    const days = leadTimes.map((l) => l.days);
    const months = leadTimes.map((l) => l.month);
    const actualAvg = mean(days);
    const variability = stdDev(days);

    // 95% confidence band: mean ± 2σ
    const lower = Math.max(0, actualAvg - 2 * variability);
    const upper = actualAvg + 2 * variability;

    // Seasonal factor: correlation of lead time with month
    const seasonal_factor = days.length > 3 ? correlation(months, days) : 0;

    const promised = supplier.lead_time_days as number;
    const bias = actualAvg - promised;

    let insight = `${supplier.name as string}: promised ${promised}d, actual avg ${actualAvg.toFixed(1)}d`;
    if (Math.abs(bias) > 2) {
      insight += bias > 0
        ? ` — consistently ${bias.toFixed(1)}d late. Add ${Math.ceil(bias)}d to your reorder trigger.`
        : ` — ${Math.abs(bias).toFixed(1)}d ahead of schedule on average.`;
    } else {
      insight += ` — lead time is reliable (within ±2d of promise).`;
    }
    if (variability > 5) {
      insight += ` High variability (σ=${variability.toFixed(1)}d) — maintain extra safety stock.`;
    }
    if (Math.abs(seasonal_factor) > 0.3) {
      insight += ` Seasonal pattern detected (r=${seasonal_factor.toFixed(2)}) — lead times vary by month.`;
    }

    profiles.push({
      supplier_id: supplier.id as string,
      supplier_name: supplier.name as string,
      promised_lead_time: promised,
      actual_avg: Math.round(actualAvg * 10) / 10,
      variability: Math.round(variability * 10) / 10,
      seasonal_factor: Math.round(seasonal_factor * 100) / 100,
      confidence_band_95: { lower: Math.round(lower * 10) / 10, upper: Math.round(upper * 10) / 10 },
      sample_size: leadTimes.length,
      insight,
    });
  }

  profiles.sort((a, b) => Math.abs(b.actual_avg - b.promised_lead_time) - Math.abs(a.actual_avg - a.promised_lead_time));

  return {
    by_supplier: profiles,
    insufficient_data: profiles.length === 0,
    message: profiles.length === 0 ? "No suppliers with 3+ received POs found." : undefined,
  };
}

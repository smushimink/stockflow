/**
 * Price elasticity of demand.
 *
 * Method: log-log linear regression on daily (price, qty) observations.
 *   ln(qty) = α + ε·ln(price)   →   slope ε = elasticity
 *
 * Only reliable with 20+ distinct price points.  If insufficient data,
 * the function returns classification "unknown" and says so explicitly.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { linearRegression, mean, stdDev, detectOutliers } from "./statistics";

export type ElasticityClass =
  | "inelastic"       // |ε| < 0.5
  | "unit_elastic"    // |ε| 0.5–1.2
  | "elastic"         // |ε| 1.2–2.5
  | "highly_elastic"  // |ε| > 2.5
  | "unknown";        // insufficient data

export interface ElasticityObservation {
  date: string;
  price: number;        // effective price after discount
  qty: number;
  discount: number;     // absolute discount applied
}

export interface PriceElasticityResult {
  elasticity: number;
  classification: ElasticityClass;
  data_points: number;
  distinct_prices: number;
  confidence: number;           // R² of log-log fit
  observations: ElasticityObservation[];
  recommended_price: number;
  expected_units_at_recommended: number;
  expected_profit_at_recommended: number;
  baseline_profit: number;
  unit_cost: number;
  current_price: number;
  insight: string;
}

const MIN_PRICE_POINTS = 20;

function classifyElasticity(e: number): ElasticityClass {
  const abs = Math.abs(e);
  if (abs < 0.5) return "inelastic";
  if (abs < 1.2) return "unit_elastic";
  if (abs < 2.5) return "elastic";
  return "highly_elastic";
}

/**
 * Given elasticity ε and unit cost, find the profit-maximising price.
 *
 * Demand curve: Q = A · P^ε  (ε < 0)
 * Profit = Q · (P − cost) = A · P^ε · (P − cost)
 * dΠ/dP = 0  ⟹  P* = cost · ε / (ε + 1)
 *
 * Valid only when ε < −1 (elastic side).
 * For inelastic goods, optimal is to raise price — capped at +15% of current.
 */
function optimalPrice(elasticity: number, unitCost: number, currentPrice: number, maxObservedPrice: number): number {
  if (elasticity >= -1) {
    // Inelastic or unit-elastic: raise price within observed range
    return Math.min(currentPrice * 1.15, maxObservedPrice);
  }
  // Elastic: profit-max formula
  const p = unitCost * elasticity / (elasticity + 1);
  if (!isFinite(p) || p <= 0) return currentPrice;
  // Clamp to observed range with 20% headroom
  return Math.min(Math.max(p, unitCost * 1.05), maxObservedPrice * 1.2);
}

export async function calculatePriceElasticity(productId: string): Promise<PriceElasticityResult> {
  const supabase = createAdminClient();

  // Get unit cost from products table
  const { data: product } = await supabase
    .from("products")
    .select("unit_cost, selling_price")
    .eq("id", productId)
    .single();

  const unitCost = (product?.unit_cost as number) ?? 0;
  const currentPrice = (product?.selling_price as number) ?? 0;

  // Last 365 days of sales for this product
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

  const { data: items } = await supabase
    .from("sales_order_items")
    .select(`
      qty, unit_price, discount,
      sales_orders!inner ( ordered_at, status )
    `)
    .eq("product_id", productId)
    .gte("sales_orders.ordered_at", since)
    .eq("sales_orders.status", "completed");

  if (!items?.length) {
    return noDataResult(unitCost, currentPrice, "No sales data in the last 365 days.");
  }

  // Group by calendar date
  type DayBucket = { totalQty: number; priceWeightedSum: number; totalDiscount: number; n: number };
  const byDay = new Map<string, DayBucket>();

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = Array.isArray(item.sales_orders) ? (item.sales_orders as any[])[0] : item.sales_orders;
    if (!order?.ordered_at) continue;

    const date = (order.ordered_at as string).slice(0, 10);
    const effectivePrice = (item.unit_price as number) - (item.discount as number);
    const qty = item.qty as number;

    if (effectivePrice <= 0 || qty <= 0) continue;

    const bucket = byDay.get(date) ?? { totalQty: 0, priceWeightedSum: 0, totalDiscount: 0, n: 0 };
    bucket.totalQty += qty;
    bucket.priceWeightedSum += effectivePrice * qty; // qty-weighted avg price
    bucket.totalDiscount += (item.discount as number) * qty;
    bucket.n++;
    byDay.set(date, bucket);
  }

  const observations: ElasticityObservation[] = Array.from(byDay.entries())
    .map(([date, b]) => ({
      date,
      price: b.priceWeightedSum / b.totalQty,
      qty: b.totalQty,
      discount: b.totalDiscount / b.totalQty,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (observations.length < 5) {
    return noDataResult(unitCost, currentPrice, `Only ${observations.length} trading days of data — need at least 5.`);
  }

  // Count distinct price points (rounded to cent)
  const distinctPrices = new Set(observations.map((o) => Math.round(o.price * 100))).size;
  if (distinctPrices < MIN_PRICE_POINTS) {
    return {
      ...noDataResult(unitCost, currentPrice, `Only ${distinctPrices} distinct price points observed — need ${MIN_PRICE_POINTS}+ to compute elasticity reliably. Vary pricing or accumulate more data.`),
      data_points: observations.length,
      distinct_prices: distinctPrices,
      observations,
    };
  }

  // Remove outliers (IQR on both price and qty)
  const priceArr = observations.map((o) => o.price);
  const qtyArr = observations.map((o) => o.qty);
  const priceOutliers = new Set(detectOutliers(priceArr, "iqr"));
  const qtyOutliers = new Set(detectOutliers(qtyArr, "iqr"));
  const clean = observations.filter((_, i) => !priceOutliers.has(i) && !qtyOutliers.has(i));

  if (clean.length < MIN_PRICE_POINTS) {
    return noDataResult(unitCost, currentPrice, `After removing outliers, only ${clean.length} observations remain.`);
  }

  // Log-log regression
  const lnPrice = clean.map((o) => Math.log(o.price));
  const lnQty = clean.map((o) => Math.log(o.qty));

  const reg = linearRegression(lnPrice, lnQty);
  const elasticity = reg.slope; // ε

  const classification = classifyElasticity(elasticity);
  const maxObservedPrice = Math.max(...clean.map((o) => o.price));
  const minObservedPrice = Math.min(...clean.map((o) => o.price));
  const avgQty = mean(clean.map((o) => o.qty));

  // Demand intercept from log-log: Q = exp(α) · P^ε
  const demandIntercept = Math.exp(reg.intercept);

  // Recommended price
  const recommended_price = optimalPrice(elasticity, unitCost, currentPrice, maxObservedPrice);

  // Predicted units at recommended price
  const expected_units_at_recommended = Math.round(
    demandIntercept * Math.pow(recommended_price, elasticity)
  );

  // Profits
  const expected_profit_at_recommended =
    expected_units_at_recommended * (recommended_price - unitCost);
  const baseline_units = Math.round(demandIntercept * Math.pow(currentPrice, elasticity));
  const baseline_profit = baseline_units * (currentPrice - unitCost);

  // Human-readable insight
  const insight = buildInsight(elasticity, classification, currentPrice, recommended_price, reg.r2, avgQty, minObservedPrice, maxObservedPrice);

  return {
    elasticity: Math.round(elasticity * 1000) / 1000,
    classification,
    data_points: clean.length,
    distinct_prices: distinctPrices,
    confidence: Math.round(reg.r2 * 1000) / 1000,
    observations: clean,
    recommended_price: Math.round(recommended_price * 100) / 100,
    expected_units_at_recommended: Math.max(0, expected_units_at_recommended),
    expected_profit_at_recommended: Math.round(expected_profit_at_recommended * 100) / 100,
    baseline_profit: Math.round(baseline_profit * 100) / 100,
    unit_cost: unitCost,
    current_price: currentPrice,
    insight,
  };
}

function buildInsight(
  elasticity: number,
  cls: ElasticityClass,
  currentPrice: number,
  recommendedPrice: number,
  r2: number,
  avgQty: number,
  minPrice: number,
  maxPrice: number
): string {
  const absE = Math.abs(elasticity).toFixed(2);
  const confidence = r2 > 0.5 ? "moderate–high" : r2 > 0.3 ? "moderate" : "low";
  const priceChange = ((recommendedPrice - currentPrice) / currentPrice * 100).toFixed(1);
  const direction = recommendedPrice > currentPrice ? "raise" : "lower";

  switch (cls) {
    case "inelastic":
      return `Demand is inelastic (ε = ${absE}): a 10% price increase reduces volume by only ${(Math.abs(elasticity) * 10).toFixed(1)}%. Raise price toward $${recommendedPrice.toFixed(2)} (+${priceChange}%) to increase profit without significantly hurting volume. Confidence: ${confidence} (R² ${(r2 * 100).toFixed(0)}%, observed $${minPrice.toFixed(2)}–$${maxPrice.toFixed(2)}).`;
    case "unit_elastic":
      return `Demand is near unit-elastic (ε = ${absE}): price and revenue move proportionally. Current price $${currentPrice.toFixed(2)} is near optimal. Focus on cost reduction rather than pricing changes. Confidence: ${confidence} (R² ${(r2 * 100).toFixed(0)}%).`;
    case "elastic":
      return `Demand is elastic (ε = ${absE}): a 10% price drop increases volume by ${(Math.abs(elasticity) * 10).toFixed(1)}%. Profit-maximising price is $${recommendedPrice.toFixed(2)} (${direction} ${Math.abs(parseFloat(priceChange)).toFixed(1)}%). Avg ${avgQty.toFixed(1)} units/day. Confidence: ${confidence} (R² ${(r2 * 100).toFixed(0)}%).`;
    case "highly_elastic":
      return `Demand is highly elastic (ε = ${absE}): customers are very price-sensitive. Small price increases cause large volume drops. Recommended price $${recommendedPrice.toFixed(2)}. Focus on volume and cost efficiency. Confidence: ${confidence} (R² ${(r2 * 100).toFixed(0)}%).`;
    default:
      return "Insufficient data to compute elasticity.";
  }
}

function noDataResult(unitCost: number, currentPrice: number, reason: string): PriceElasticityResult {
  return {
    elasticity: 0,
    classification: "unknown",
    data_points: 0,
    distinct_prices: 0,
    confidence: 0,
    observations: [],
    recommended_price: currentPrice,
    expected_units_at_recommended: 0,
    expected_profit_at_recommended: 0,
    baseline_profit: 0,
    unit_cost: unitCost,
    current_price: currentPrice,
    insight: reason,
  };
}

/** Batch: run elasticity for multiple products, skip unknowns */
export async function calculateElasticityBatch(
  productIds: string[]
): Promise<Map<string, PriceElasticityResult>> {
  const results = new Map<string, PriceElasticityResult>();
  for (const id of productIds) {
    results.set(id, await calculatePriceElasticity(id));
  }
  return results;
}

/** Describe elasticity in simple terms for UI */
export function describeElasticity(e: number): string {
  const abs = Math.abs(e);
  if (abs < 0.5) return "Price insensitive";
  if (abs < 1.2) return "Moderately sensitive";
  if (abs < 2.5) return "Price sensitive";
  return "Highly price sensitive";
}

/** Estimate demand at a given price using the calibrated demand curve */
export function estimateDemand(
  targetPrice: number,
  referencePrice: number,
  referenceQty: number,
  elasticity: number
): number {
  if (referencePrice <= 0 || targetPrice <= 0) return 0;
  return referenceQty * Math.pow(targetPrice / referencePrice, elasticity);
}

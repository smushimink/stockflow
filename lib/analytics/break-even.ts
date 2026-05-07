import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductBreakEvenResult {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  sellingPrice: number;
  unitCost: number;
  contributionMarginPerUnit: number;
  fixedCostAllocation: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  currentMonthlySales: number;
  monthsToBreakEven: number | null;
  status: "profitable" | "marginal" | "unprofitable";
}

export interface PoBreakEvenItem {
  productId: string | null;
  qty: number;
  unitCost: number;
  sellingPrice: number;
  avgDailySales: number;
}

export interface PoBreakEvenResult {
  totalCost: number;
  unitsToBreakEven: number;
  expectedRevenue: number;
  expectedTimeToClears: number;       // days to sell all units at current avg pace
  expectedProfit: number;
  expectedRoi: number;                // %
  riskFactor: "low" | "medium" | "high";
}

export interface DiscountBreakEvenResult {
  currentMargin: number;              // per unit
  newMargin: number;                  // per unit at discounted price
  currentTotalProfit: number;         // selling all stock at full price
  unitsToMatchCurrentProfit: number;  // units needed at new price to match full-price profit
  feasibility: "easy" | "moderate" | "unrealistic";
}

export interface NewProductBreakEvenResult {
  contributionMargin: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  expectedMonthlyProfit: number;
  expectedRoi: number;
  monthsToBreakEven: number | null;
}

// ── Pure: PO break-even ───────────────────────────────────────────────────────

export function calcPoBreakEven(items: PoBreakEvenItem[]): PoBreakEvenResult | null {
  const filled = items.filter((i) => i.qty > 0 && i.unitCost > 0 && i.sellingPrice > 0);
  if (!filled.length) return null;

  const totalCost = filled.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const expectedRevenue = filled.reduce((s, i) => s + i.qty * i.sellingPrice, 0);
  const expectedProfit = expectedRevenue - totalCost;
  const expectedRoi = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

  const totalUnits = filled.reduce((s, i) => s + i.qty, 0);
  const totalMargin = expectedRevenue - totalCost;
  const avgMarginPerUnit = totalUnits > 0 ? totalMargin / totalUnits : 0;
  const unitsToBreakEven =
    avgMarginPerUnit > 0 ? Math.ceil(totalCost / avgMarginPerUnit) : totalUnits;

  const totalDailySales = filled.reduce((s, i) => s + i.avgDailySales, 0);
  const expectedTimeToClears = totalDailySales > 0 ? totalUnits / totalDailySales : Infinity;

  let riskFactor: PoBreakEvenResult["riskFactor"];
  if (expectedTimeToClears <= 30) riskFactor = "low";
  else if (expectedTimeToClears <= 90) riskFactor = "medium";
  else riskFactor = "high";

  return {
    totalCost,
    unitsToBreakEven,
    expectedRevenue,
    expectedTimeToClears,
    expectedProfit,
    expectedRoi,
    riskFactor,
  };
}

// ── Pure: discount break-even ─────────────────────────────────────────────────

export function calcDiscountBreakEven(
  sellingPrice: number,
  unitCost: number,
  stockOnHand: number,
  discountPct: number
): DiscountBreakEvenResult {
  const newPrice = sellingPrice * (1 - discountPct / 100);
  const currentMargin = sellingPrice - unitCost;
  const newMargin = newPrice - unitCost;
  const currentTotalProfit = stockOnHand * currentMargin;

  const unitsToMatchCurrentProfit =
    newMargin > 0 ? Math.ceil(currentTotalProfit / newMargin) : Infinity;

  // Feasibility: can we actually sell that many?
  let feasibility: DiscountBreakEvenResult["feasibility"];
  if (unitsToMatchCurrentProfit <= stockOnHand) {
    feasibility = "easy";
  } else if (unitsToMatchCurrentProfit <= stockOnHand * 2) {
    feasibility = "moderate";
  } else {
    feasibility = "unrealistic";
  }

  return { currentMargin, newMargin, currentTotalProfit, unitsToMatchCurrentProfit, feasibility };
}

// ── Pure: new product break-even ──────────────────────────────────────────────

export function calcNewProductBreakEven(
  estimatedCost: number,
  estimatedPrice: number,
  estimatedMonthlyVolume: number
): NewProductBreakEvenResult {
  const contributionMargin = estimatedPrice - estimatedCost;
  const breakEvenUnits = contributionMargin > 0 ? Math.ceil(estimatedCost / contributionMargin) : Infinity;
  const breakEvenRevenue = breakEvenUnits * estimatedPrice;
  const expectedMonthlyProfit = estimatedMonthlyVolume * contributionMargin;
  const expectedRoi = estimatedCost > 0 ? (expectedMonthlyProfit / estimatedCost) * 100 : 0;
  const monthsToBreakEven =
    estimatedMonthlyVolume > 0 && breakEvenUnits < Infinity
      ? breakEvenUnits / estimatedMonthlyVolume
      : null;

  return { contributionMargin, breakEvenUnits, breakEvenRevenue, expectedMonthlyProfit, expectedRoi, monthsToBreakEven };
}

// ── DB: all-product break-even (for dashboard) ────────────────────────────────

export async function calculateAllProductBreakEven(
  orgId: string,
  warehouseCostMonthly: number | null
): Promise<ProductBreakEvenResult[]> {
  const supabase = createAdminClient();

  const { data: metrics } = await supabase
    .from("product_metrics")
    .select(`
      product_id,
      avg_daily_sales_30d, avg_daily_sales_7d, real_unit_cost,
      products (
        id, sku, name, category, selling_price, unit_cost, stock_on_hand, status, weight_kg
      )
    `)
    .eq("organization_id", orgId);

  if (!metrics?.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeRows = (metrics as any[]).filter((m) => {
    const p = Array.isArray(m.products) ? m.products[0] : m.products;
    return p?.status === "active";
  });

  // Proportional fixed-cost allocation by stock count
  const totalStock = activeRows.reduce((sum, m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = Array.isArray(m.products) ? m.products[0] : m.products as any;
    return sum + ((p?.stock_on_hand as number) ?? 0);
  }, 0);

  const results: ProductBreakEvenResult[] = [];

  for (const m of activeRows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (Array.isArray(m.products) ? m.products[0] : m.products) as any;
    if (!p) continue;

    const sellingPrice = p.selling_price as number;
    // Prefer real_unit_cost (includes platform fees) over catalogue unit_cost
    const unitCost =
      (m.real_unit_cost as number) > 0
        ? (m.real_unit_cost as number)
        : (p.unit_cost as number);
    const contributionMarginPerUnit = sellingPrice - unitCost;

    const stockOnHand = (p.stock_on_hand as number) ?? 0;
    const stockShare = totalStock > 0 ? stockOnHand / totalStock : 0;
    const fixedCostAllocation = (warehouseCostMonthly ?? 0) * stockShare;

    const breakEvenUnits =
      contributionMarginPerUnit > 0 && fixedCostAllocation > 0
        ? Math.ceil(fixedCostAllocation / contributionMarginPerUnit)
        : contributionMarginPerUnit <= 0
        ? Infinity
        : 0;

    const breakEvenRevenue =
      breakEvenUnits === Infinity ? Infinity : breakEvenUnits * sellingPrice;

    const avgDaily =
      (m.avg_daily_sales_30d as number) > 0
        ? (m.avg_daily_sales_30d as number)
        : ((m.avg_daily_sales_7d as number) ?? 0);
    const currentMonthlySales = avgDaily * 30;

    let status: ProductBreakEvenResult["status"];
    if (contributionMarginPerUnit <= 0) {
      status = "unprofitable";
    } else if (breakEvenUnits === 0 || currentMonthlySales >= breakEvenUnits) {
      status = "profitable";
    } else if (currentMonthlySales >= breakEvenUnits * 0.8) {
      status = "marginal";
    } else {
      status = "unprofitable";
    }

    const monthsToBreakEven =
      currentMonthlySales > 0 && breakEvenUnits > 0 && breakEvenUnits < Infinity
        ? breakEvenUnits / currentMonthlySales
        : null;

    results.push({
      productId: p.id as string,
      sku: p.sku as string,
      name: p.name as string,
      category: (p.category as string | null) ?? null,
      sellingPrice,
      unitCost,
      contributionMarginPerUnit,
      fixedCostAllocation,
      breakEvenUnits: breakEvenUnits === Infinity ? 0 : breakEvenUnits,
      breakEvenRevenue: breakEvenRevenue === Infinity ? 0 : breakEvenRevenue,
      currentMonthlySales,
      monthsToBreakEven,
      status,
    });
  }

  // Sort: unprofitable → marginal → profitable, then by months-to-break-even
  results.sort((a, b) => {
    const order = { unprofitable: 0, marginal: 1, profitable: 2 };
    const sd = order[a.status] - order[b.status];
    if (sd !== 0) return sd;
    return (a.monthsToBreakEven ?? 999) - (b.monthsToBreakEven ?? 999);
  });

  return results;
}

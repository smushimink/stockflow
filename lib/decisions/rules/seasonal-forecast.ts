import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import type { MonthIndex } from "@/lib/analytics/seasonality";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

// ── Legacy config-based season shape (fallback only) ─────────────────────────

interface LegacySeason {
  name: string;
  start_month: number;
  start_day: number;
}

interface SeasonalConfig {
  warning_days?: number;
  critical_days?: number;
  growth_factor?: number;
  // Legacy: still honoured when no DB patterns exist
  seasons?: LegacySeason[];
}

const DEFAULT_SEASONS: LegacySeason[] = [
  { name: "CNY",       start_month: 1,  start_day: 25 },
  { name: "Christmas", start_month: 11, start_day: 1  },
  { name: "Easter",    start_month: 4,  start_day: 1  },
];

function daysUntilNext(month: number, day: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), month - 1, day);
  if (target <= now) target.setFullYear(now.getFullYear() + 1);
  return Math.floor((target.getTime() - now.getTime()) / 864e5);
}

function windowForSeason(month: number, day: number, year: number) {
  const start = new Date(year, month - 1, day);
  const end   = new Date(start.getTime() + 30 * 864e5);
  return { from: start.toISOString(), to: end.toISOString() };
}

// Days until the 1st of `month` (next occurrence)
function daysUntilMonthStart(month: number): number {
  return daysUntilNext(month, 1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

function categoryTrendMultiplier(
  category: string | null | undefined,
  marketSignals: import("@/lib/decisions/types").MarketSignal[]
): { multiplier: number; label: string | null } {
  if (!category) return { multiplier: 1, label: null };
  const sig = marketSignals.find(
    (s) =>
      s.signal_type === "category_trend" &&
      typeof (s.value as { category?: string }).category === "string" &&
      (s.value as { category: string }).category.toLowerCase() === category.toLowerCase()
  );
  if (!sig) return { multiplier: 1, label: null };
  const trend = (sig.value as { trend?: string }).trend;
  if (trend === "rising")   return { multiplier: 1.15, label: "rising (+15%)" };
  if (trend === "declining") return { multiplier: 0.85, label: "declining (−15%)" };
  return { multiplier: 1, label: "stable" };
}

// ── Rule ──────────────────────────────────────────────────────────────────────

export const seasonalForecastRule: DecisionRule = {
  rule_type: "seasonal_preorder",
  defaultConfig: {
    warning_days:  90,
    critical_days: 60,
    growth_factor: 1.1,
    seasons: DEFAULT_SEASONS,
  },

  async evaluate({ orgId, config, businessContext, marketSignals }: RuleContext): Promise<Alert[]> {
    const {
      warning_days  = 90,
      critical_days = 60,
      growth_factor = 1.1,
      seasons = DEFAULT_SEASONS,
    } = config as SeasonalConfig;

    const supabase = createAdminClient();
    const alerts: Alert[] = [];
    const now = new Date();

    // ── Path A: use auto-detected patterns from seasonality_patterns ───────────

    const { data: patterns } = await supabase
      .from("seasonality_patterns")
      .select(`
        id, product_id, peak_periods, confidence,
        products (
          id, sku, name, stock_on_hand, unit_cost, lead_time_days, status,
          suppliers ( id, name )
        )
      `)
      .eq("organization_id", orgId)
      .eq("pattern_type", "annual");

    if (patterns && patterns.length > 0) {
      // Also pull avg daily sales for each product from product_metrics
      const { data: metricsRows } = await supabase
        .from("product_metrics")
        .select("product_id, avg_daily_sales_30d, avg_daily_sales_7d")
        .eq("organization_id", orgId);

      const metricsMap = new Map(
        (metricsRows ?? []).map((m) => [m.product_id as string, m])
      );

      for (const pattern of patterns) {
        const product = firstOf(
          pattern.products as
            | { id: string; sku: string; name: string; stock_on_hand: number; unit_cost: number; lead_time_days: number | null; status: string; suppliers: unknown }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            | any
        );
        if (!product || product.status !== "active") continue;

        const peakPeriods = pattern.peak_periods as MonthIndex[];
        const metrics = metricsMap.get(product.id as string);
        const avgDaily =
          (metrics?.avg_daily_sales_30d as number) > 0
            ? (metrics?.avg_daily_sales_30d as number)
            : (metrics?.avg_daily_sales_7d as number ?? 0);

        if (avgDaily <= 0) continue;

        for (const peak of peakPeriods) {
          if (peak.multiplier < 1.4) continue; // only significant peaks

          const daysUntil = daysUntilMonthStart(peak.month);
          if (daysUntil > warning_days || daysUntil <= 0) continue;

          const lead_time = (product.lead_time_days as number | null) ?? 14;

          // Category trend from market signals (rising +15%, declining −15%)
          const trendCtx = categoryTrendMultiplier(product.category as string | null, marketSignals);

          // Expected demand = avg_daily × 30 × seasonal_multiplier × growth_factor × trend_multiplier
          const expectedMonthlyDemand = Math.ceil(
            avgDaily * 30 * peak.multiplier * growth_factor * trendCtx.multiplier
          );
          const stockOnHand = product.stock_on_hand as number;

          if (stockOnHand >= expectedMonthlyDemand) continue;

          const gap = expectedMonthlyDemand - stockOnHand;
          const supplier = firstOf(product.suppliers as { id: string; name: string } | { id: string; name: string }[] | null);

          const peakDate = new Date(now.getFullYear(), peak.month - 1, 1);
          if (peakDate <= now) peakDate.setFullYear(now.getFullYear() + 1);
          const peakLabel = peakDate.toLocaleDateString("en-AU", { month: "short", year: "numeric" });

          const severity: Alert["severity"] = daysUntil <= critical_days ? "red" : "orange";

          const trail: ReasoningSegment[] = [
            {
              type: "historical",
              label: "Seasonal pattern",
              text: `Detected annual pattern: month ${peak.month} sales typically ${((peak.multiplier - 1) * 100).toFixed(0)}% above average (confidence ${Math.round((pattern.confidence as number) * 100)}%).`,
            },
            {
              type: "data",
              label: "Sales velocity",
              text: `Avg daily sales (30d): ${avgDaily.toFixed(1)} units/day.`,
            },
            {
              type: "rule",
              label: "Growth factor",
              text: `Growth factor: ${growth_factor}× (org config — expected YoY demand growth).`,
            },
            {
              type: "calc",
              label: "Peak demand",
              text: `Expected peak demand = ${avgDaily.toFixed(1)}/day × 30 × ${peak.multiplier.toFixed(2)} seasonal × ${growth_factor} growth${trendCtx.multiplier !== 1 ? ` × ${trendCtx.multiplier} trend` : ""} = ${expectedMonthlyDemand} units.`,
            },
            ...(trendCtx.label
              ? [{ type: "signal" as const, label: "Category trend", text: `Market signal: category trend ${trendCtx.label} — demand adjusted by ${trendCtx.multiplier > 1 ? "+" : ""}${((trendCtx.multiplier - 1) * 100).toFixed(0)}%.` }]
              : []),
            {
              type: "data",
              label: "Stock gap",
              text: `Current stock: ${stockOnHand} units. Gap: ${gap} units short for peak. Lead time: ${lead_time}d.`,
            },
            {
              type: "verdict",
              label: "Trigger",
              text: `${daysUntil}d until ${peakLabel} peak (${daysUntil <= critical_days ? "critical" : "warning"} window). Order ${gap} units now to cover anticipated demand.`,
            },
          ];

          alerts.push({
            organization_id: orgId,
            rule_type: "seasonal_preorder",
            related_product_id: product.id as string,
            severity,
            title: `Seasonal peak ${peak.month < 10 ? "0" : ""}${peak.month} — ${product.sku as string}`,
            summary: `${gap} units short for ${peakLabel} peak · ${daysUntil}d away · stock covers avg demand only`,
            reasoning: segmentsToText(trail),
            suggested_action: "Create pre-season purchase order",
            suggested_qty: gap,
            suggested_value: gap * (product.unit_cost as number),
            metadata: {
              peak_month: peak.month,
              peak_multiplier: peak.multiplier,
              confidence: pattern.confidence,
              expected_demand: expectedMonthlyDemand,
              stock_on_hand: stockOnHand,
              avg_daily_sales: avgDaily,
              lead_time_days: lead_time,
              days_until_start: daysUntil,
              days_until_peak: daysUntil,
              supplier_id: supplier?.id ?? null,
              supplier_name: supplier?.name ?? null,
              sku: product.sku,
              detected_pattern: true,
              category_trend: trendCtx.label,
              reasoning_trail: trail,
            },
          });
        }
      }

      return alerts;
    }

    // ── Path B: fallback to legacy config-based seasons ────────────────────────
    // Used when detection hasn't been run yet or org has insufficient history.

    const activeSeasonsFilter = businessContext.active_seasons;
    const relevantSeasons =
      activeSeasonsFilter.length > 0
        ? seasons.filter((s) => activeSeasonsFilter.includes(s.name))
        : seasons;

    for (const season of relevantSeasons) {
      const days_until = daysUntilNext(season.start_month, season.start_day);
      if (days_until > warning_days || days_until <= 0) continue;

      const { data: products, error } = await supabase
        .from("products")
        .select(`
          id, sku, name, stock_on_hand, unit_cost, lead_time_days, status,
          suppliers ( id, name )
        `)
        .eq("organization_id", orgId)
        .eq("status", "active")
        .contains("season_tags", [season.name]);

      if (error) throw error;
      if (!products?.length) continue;

      const lastYearWindow = windowForSeason(
        season.start_month,
        season.start_day,
        now.getFullYear() - 1
      );

      const { data: lastYearSales } = await supabase
        .from("sales_order_items")
        .select("product_id, qty, sales_orders!inner(ordered_at, status)")
        .eq("organization_id", orgId)
        .not("product_id", "is", null);

      const lastYearByProduct = new Map<string, number>();
      for (const item of lastYearSales ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = firstOf((item as any).sales_orders);
        if (!order) continue;
        const { ordered_at, status } = order as { ordered_at: string; status: string };
        if (status !== "completed") continue;
        if (ordered_at < lastYearWindow.from || ordered_at > lastYearWindow.to) continue;
        const pid = item.product_id as string;
        lastYearByProduct.set(pid, (lastYearByProduct.get(pid) ?? 0) + (item.qty as number));
      }

      for (const product of products) {
        const last_year_sales = lastYearByProduct.get(product.id) ?? 0;
        const expected_demand = Math.ceil(last_year_sales * growth_factor);

        if (expected_demand === 0 || (product.stock_on_hand as number) >= expected_demand) continue;

        const gap = expected_demand - (product.stock_on_hand as number);
        const lead_time = (product.lead_time_days as number | null) ?? 14;
        const supplier = firstOf(product.suppliers as { id: string; name: string } | { id: string; name: string }[] | null);
        const season_date = new Date(now.getFullYear(), season.start_month - 1, season.start_day);
        if (season_date <= now) season_date.setFullYear(now.getFullYear() + 1);

        const legacyTrail: ReasoningSegment[] = [
          {
            type: "historical",
            label: "Last year",
            text: `${season.name} last year (same window): ${last_year_sales} units sold.`,
          },
          {
            type: "rule",
            label: "Growth factor",
            text: `Growth factor: ${growth_factor}× (org config — expected YoY growth).`,
          },
          {
            type: "calc",
            label: "Expected demand",
            text: `Expected demand = ${last_year_sales} × ${growth_factor} = ${expected_demand} units.`,
          },
          {
            type: "data",
            label: "Stock gap",
            text: `Current stock: ${product.stock_on_hand as number} units. Gap: ${gap} units. Lead time: ${lead_time}d.`,
          },
          {
            type: "context",
            label: "Pattern source",
            text: `Using hardcoded season config (no auto-detected pattern). Run seasonality detection for data-driven forecasts.`,
          },
          {
            type: "verdict",
            label: "Trigger",
            text: `${days_until}d until ${season.name} (${days_until <= critical_days ? "critical" : "warning"} window). Pre-order ${gap} units.`,
          },
        ];

        alerts.push({
          organization_id: orgId,
          rule_type: "seasonal_preorder",
          related_product_id: product.id as string,
          severity: days_until <= critical_days ? "red" : "orange",
          title: `${season.name} pre-order: ${product.sku as string}`,
          summary: `Need ${gap} units before ${season_date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · lead time ${lead_time}d`,
          reasoning: segmentsToText(legacyTrail),
          suggested_action: "Plan order",
          suggested_qty: gap,
          suggested_value: gap * (product.unit_cost as number),
          metadata: {
            season: season.name,
            days_until_start: days_until,
            expected_demand,
            last_year_sales,
            growth_factor,
            lead_time_days: lead_time,
            stock_on_hand: product.stock_on_hand,
            supplier_id: supplier?.id ?? null,
            supplier_name: supplier?.name ?? null,
            sku: product.sku,
            detected_pattern: false,
            reasoning_trail: legacyTrail,
          },
        });
      }
    }

    return alerts;
  },
};

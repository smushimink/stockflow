import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

interface Season {
  name: string;
  start_month: number;
  start_day: number;
}

interface SeasonalConfig {
  seasons?: Season[];
  warning_days?: number;
  critical_days?: number;
  growth_factor?: number;
}

const DEFAULT_SEASONS: Season[] = [
  { name: "CNY", start_month: 1, start_day: 25 },
  { name: "Christmas", start_month: 11, start_day: 1 },
  { name: "Easter", start_month: 4, start_day: 1 },
];

function daysUntilNext(month: number, day: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), month - 1, day);
  if (target.getTime() <= now.getTime()) target.setFullYear(now.getFullYear() + 1);
  return Math.floor((target.getTime() - now.getTime()) / (24 * 3600 * 1000));
}

function windowForSeason(month: number, day: number, year: number): { from: string; to: string } {
  const start = new Date(year, month - 1, day);
  const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

export const seasonalForecastRule: DecisionRule = {
  rule_type: "seasonal_preorder",
  defaultConfig: {
    seasons: DEFAULT_SEASONS,
    warning_days: 90,
    critical_days: 60,
    growth_factor: 1.1,
  },

  async evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]> {
    const {
      seasons = DEFAULT_SEASONS,
      warning_days = 90,
      critical_days = 60,
      growth_factor = 1.1,
    } = config as SeasonalConfig;

    const supabase = createAdminClient();
    const alerts: Alert[] = [];
    const now = new Date();

    for (const season of seasons) {
      const days_until = daysUntilNext(season.start_month, season.start_day);
      if (days_until > warning_days || days_until <= 0) continue;

      // Find products tagged for this season
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

      // Compute expected demand from last year same window
      const lastYearWindow = windowForSeason(season.start_month, season.start_day, now.getFullYear() - 1);

      const { data: lastYearSales } = await supabase
        .from("sales_order_items")
        .select("product_id, qty, sales_orders!inner(ordered_at, status)")
        .eq("organization_id", orgId)
        .not("product_id", "is", null);
        // Note: filter by date in JS since PostgREST embedded filters vary by version

      const lastYearByProduct = new Map<string, number>();
      for (const item of lastYearSales ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = firstOf((item as any).sales_orders);
        if (!order) continue;
        const orderedAt = (order as { ordered_at: string; status: string }).ordered_at;
        const status = (order as { ordered_at: string; status: string }).status;
        if (status !== "completed") continue;
        if (orderedAt < lastYearWindow.from || orderedAt > lastYearWindow.to) continue;
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
        if (season_date.getTime() <= now.getTime()) season_date.setFullYear(now.getFullYear() + 1);

        const severity: Alert["severity"] = days_until <= critical_days ? "red" : "orange";

        alerts.push({
          organization_id: orgId,
          rule_type: "seasonal_preorder",
          related_product_id: product.id as string,
          severity,
          title: `${season.name} pre-order: ${product.sku as string}`,
          summary: `Need ${gap} units before ${season_date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · lead time ${lead_time}d`,
          reasoning: `Last year ${season.name} window: ${last_year_sales} units sold. Expected this year: ${expected_demand} (×${growth_factor} growth factor). Current stock: ${product.stock_on_hand as number}. Gap: ${gap} units. ${days_until} days until season start.`,
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
          },
        });
      }
    }

    return alerts;
  },
};

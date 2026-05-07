import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, MarketSignal, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface ReorderConfig {
  safety_factor?: number;
  target_cover_days?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

const SEV_ORDER = { red: 0, orange: 1, yellow: 2, green: 3 } as const;

const INDUSTRY_SAFETY_FACTOR: Record<string, number> = {
  food_grocery: 1.5,
  industrial: 1.2,
};

export const reorderRule: DecisionRule = {
  rule_type: "reorder",
  defaultConfig: { safety_factor: 1.3, target_cover_days: 30 },

  async evaluate({ orgId, config, businessContext, marketSignals }: RuleContext): Promise<Alert[]> {
    const { target_cover_days: base_cover_days = 30 } = config as ReorderConfig;

    // Industry-aware safety factor: config overrides, then industry default, then 1.3
    const base_safety_factor =
      (config as ReorderConfig).safety_factor ??
      INDUSTRY_SAFETY_FACTOR[businessContext.industry] ??
      1.3;

    const supabase = createAdminClient();

    // Load probabilistic forecasts (null for products without sufficient history)
    const { data: forecastRows } = await supabase
      .from("product_forecasts")
      .select("product_id, recommended_rop, recommended_target_stock, recommended_order_qty, demand_pattern, fit_quality, ltd_mean, ltd_p95, lambda, censored_days, data_points, warning")
      .eq("organization_id", orgId);

    const forecasts = new Map<string, Record<string, unknown>>(
      (forecastRows ?? []).map((f) => [f.product_id as string, f as Record<string, unknown>])
    );

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id,
        avg_daily_sales_30d, avg_daily_sales_7d, days_of_cover,
        products (
          id, sku, name, unit_cost, stock_on_hand,
          lead_time_days, moq, status, rule_overrides,
          suppliers ( id, name, lead_time_days, currency )
        )
      `)
      .eq("organization_id", orgId);

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const m of metrics ?? []) {
      const product = firstOf(
        m.products as
          | { id: string; sku: string; name: string; unit_cost: number; stock_on_hand: number; lead_time_days: number | null; moq: number | null; status: string; rule_overrides: Record<string, Record<string, unknown>> | null; suppliers: unknown }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | any
      );
      if (!product || product.status !== "active") continue;

      // Merge per-product rule overrides (product wins over org config)
      const productOverrides = ((product.rule_overrides as Record<string, Record<string, unknown>> | null)?.reorder) ?? {};
      const safety_factor = (productOverrides.safety_factor as number | undefined) ?? base_safety_factor;
      const target_cover_days = (productOverrides.target_cover_days as number | undefined) ?? base_cover_days;

      const avg_daily_30 = m.avg_daily_sales_30d as number;
      const avg_daily_7 = m.avg_daily_sales_7d as number;
      const avg_daily = avg_daily_30 > 0 ? avg_daily_30 : avg_daily_7;
      if (avg_daily <= 0) continue;

      const supplier = firstOf(product.suppliers as { id: string; name: string; lead_time_days: number; currency: string } | { id: string; name: string; lead_time_days: number; currency: string }[] | null);
      const lead_time: number = product.lead_time_days ?? supplier?.lead_time_days ?? 14;

      // Use probabilistic ROP if available and fit quality is acceptable
      const forecast = forecasts.get(m.product_id as string);
      const useProbabilistic =
        forecast &&
        forecast.recommended_rop != null &&
        (forecast.fit_quality as number) >= 0.3 &&
        forecast.demand_pattern !== "lumpy" &&
        forecast.demand_pattern !== "sparse";

      const reorder_point = useProbabilistic
        ? (forecast!.recommended_rop as number)
        : avg_daily * lead_time * safety_factor;

      if ((product.stock_on_hand as number) > reorder_point) continue;

      const days_of_cover = m.days_of_cover as number;
      const moq = (product.moq as number | null) ?? 1;
      const suggested_qty = useProbabilistic && (forecast!.recommended_order_qty as number) > 0
        ? Math.max(moq, Math.ceil(forecast!.recommended_order_qty as number))
        : Math.max(moq, Math.ceil(avg_daily * target_cover_days - (product.stock_on_hand as number)));

      let severity: Alert["severity"];
      if (days_of_cover < lead_time) severity = "red";
      else if (days_of_cover < lead_time * 1.5) severity = "orange";
      else severity = "yellow";

      const supplier_name = supplier?.name ?? "Unknown supplier";
      const supplierCurrency = (supplier?.currency as string) ?? businessContext.primary_currency;

      // Determine safety factor source for the trail
      const sfSource =
        (productOverrides.safety_factor as number | undefined) !== undefined
          ? "product override"
          : (config as ReorderConfig).safety_factor !== undefined
          ? "org config"
          : INDUSTRY_SAFETY_FACTOR[businessContext.industry]
          ? `industry default (${businessContext.industry})`
          : "base default";

      // 7d vs 30d velocity trend
      let velocityNote = "";
      if (avg_daily_7 > 0 && avg_daily_30 > 0) {
        if (avg_daily_7 > avg_daily_30 * 1.2)
          velocityNote = ` 7-day avg ${avg_daily_7.toFixed(1)}/d is accelerating (+${(((avg_daily_7 / avg_daily_30) - 1) * 100).toFixed(0)}%) vs 30-day trend.`;
        else if (avg_daily_7 < avg_daily_30 * 0.8)
          velocityNote = ` 7-day avg ${avg_daily_7.toFixed(1)}/d is slowing (${(((avg_daily_7 / avg_daily_30) - 1) * 100).toFixed(0)}%) vs 30-day trend.`;
      }

      // FX note: if supplier transacts in a foreign currency and an FX signal exists
      // showing a shift > 5%, append a cost-impact note to reasoning.
      let fxNote = "";
      if (supplierCurrency !== businessContext.primary_currency) {
        const fxSignal = (marketSignals as MarketSignal[]).find(
          (s) =>
            s.signal_type === "fx_rate" &&
            (s.value as { from_currency?: string; to_currency?: string }).from_currency === supplierCurrency &&
            (s.value as { from_currency?: string; to_currency?: string }).to_currency === businessContext.primary_currency
        );
        if (fxSignal) {
          const fv = fxSignal.value as { rate?: number; prior_rate?: number };
          if (fv.rate != null && fv.prior_rate != null && fv.prior_rate !== 0) {
            const shift = ((fv.rate - fv.prior_rate) / fv.prior_rate) * 100;
            if (Math.abs(shift) > 5) {
              const costImpact = shift > 0 ? `+${shift.toFixed(1)}%` : `${shift.toFixed(1)}%`;
              fxNote = `FX: ${supplierCurrency}/${businessContext.primary_currency} moved ${fv.prior_rate} → ${fv.rate} (${costImpact} from FX shift) — import costs affected.`;
            }
          }
        }
      }

      // ── Reasoning trail ──────────────────────────────────────────────────────

      const trail: ReasoningSegment[] = [
        {
          type: "data",
          label: "Sales velocity",
          text: `Avg daily sales (30d): ${avg_daily.toFixed(1)} units/day.${velocityNote}`,
        },
        {
          type: "data",
          label: "Lead time",
          text: `Supplier ${supplier_name}: lead time ${lead_time} days.`,
        },
        {
          type: "rule",
          label: "Safety factor",
          text: `Safety factor: ${safety_factor}× (${sfSource}).`,
        },
        {
          type: "rule",
          label: "Cover target",
          text: `Target cover: ${target_cover_days} days.`,
        },
        {
          type: "calc",
          label: "Reorder point",
          text: `Reorder point = ${avg_daily.toFixed(1)} × ${lead_time} × ${safety_factor} = ${reorder_point.toFixed(1)} units. Stock on hand: ${product.stock_on_hand as number} → below threshold.`,
        },
        ...(fxNote
          ? [{ type: "signal" as const, label: "FX exposure", text: fxNote }]
          : []),
        ...(productOverrides.safety_factor !== undefined || productOverrides.target_cover_days !== undefined
          ? [{ type: "context" as const, label: "Product override", text: `Per-product rule override active: ${Object.entries(productOverrides).map(([k, v]) => `${k}=${v}`).join(", ")}.` }]
          : []),
        {
          type: "verdict",
          label: "Trigger",
          text: `${days_of_cover < lead_time ? "Stockout risk" : "Reorder needed"}: ${Math.floor(days_of_cover)}d of cover remaining (lead time ${lead_time}d). Suggested order: ${suggested_qty} units${moq > 1 ? ` (MOQ ${moq})` : ""}.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "reorder",
        related_product_id: product.id as string,
        severity,
        title: `Reorder ${product.sku as string}`,
        summary: `${suggested_qty} units from ${supplier_name} · runs out in ${Math.floor(days_of_cover)}d`,
        reasoning: segmentsToText(trail),
        suggested_action: "Create purchase order",
        suggested_value: suggested_qty * (product.unit_cost as number),
        suggested_qty,
        metadata: {
          avg_daily_sales: avg_daily,
          avg_daily_sales_30d: avg_daily_30,
          avg_daily_sales_7d: avg_daily_7,
          lead_time_days: lead_time,
          days_of_cover,
          supplier_name,
          supplier_id: supplier?.id ?? null,
          supplier_currency: supplierCurrency,
          reorder_point: Math.ceil(reorder_point),
          stock_on_hand: product.stock_on_hand,
          sku: product.sku,
          safety_factor,
          fx_note: fxNote || null,
          reasoning_trail: trail,
          // Probabilistic model metadata
          probabilistic: useProbabilistic ? {
            demand_pattern: forecast!.demand_pattern,
            fit_quality: forecast!.fit_quality,
            lambda: forecast!.lambda,
            ltd_p95: forecast!.ltd_p95,
            censored_days: forecast!.censored_days,
            data_points: forecast!.data_points,
          } : null,
        },
      });
    }

    alerts.sort((a, b) => {
      const sd = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (sd !== 0) return sd;
      return (a.metadata.days_of_cover as number) - (b.metadata.days_of_cover as number);
    });

    return alerts;
  },
};

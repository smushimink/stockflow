import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface EcommercePipelineConfig {
  min_margin?: number;
  min_days_cover?: number;
  limit?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? ((v as T[])[0] ?? null) : v;
}

export const ecommercePipelineRule: DecisionRule = {
  rule_type: "ecommerce_pipeline",
  defaultConfig: { min_margin: 0.25, min_days_cover: 30, limit: 5 },

  async evaluate({ orgId, config }: RuleContext): Promise<Alert[]> {
    const { min_margin = 0.25, min_days_cover = 30, limit = 5 } = config as EcommercePipelineConfig;

    const supabase = createAdminClient();

    const { data: metrics, error } = await supabase
      .from("product_metrics")
      .select(`
        product_id, real_margin_pct, days_of_cover, abc_class,
        products (
          id, sku, name, listed_online, status, selling_price
        )
      `)
      .eq("organization_id", orgId)
      .gte("real_margin_pct", min_margin)
      .gte("days_of_cover", min_days_cover)
      .in("abc_class", ["A", "B"]);

    if (error) throw error;

    type Candidate = {
      product_id: string; sku: string; name: string;
      real_margin_pct: number; days_of_cover: number; abc_class: string; selling_price: number;
    };

    const candidates: Candidate[] = (metrics ?? [])
      .map((m): Candidate | null => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = firstOf(m.products as any);
        if (!product || product.status !== "active" || product.listed_online) return null;
        return {
          product_id: m.product_id as string,
          sku: product.sku as string,
          name: product.name as string,
          real_margin_pct: m.real_margin_pct as number,
          days_of_cover: m.days_of_cover as number,
          abc_class: m.abc_class as string,
          selling_price: product.selling_price as number,
        };
      })
      .filter((x): x is Candidate => x !== null)
      .sort((a, b) => b.real_margin_pct - a.real_margin_pct)
      .slice(0, limit);

    if (candidates.length === 0) return [];

    const avg_margin = candidates.reduce((s: number, c: Candidate) => s + c.real_margin_pct, 0) / candidates.length;
    const avg_cover = candidates.reduce((s: number, c: Candidate) => s + c.days_of_cover, 0) / candidates.length;
    const classLabel = [...new Set(candidates.map((c: Candidate) => c.abc_class))].sort().join("/");
    const topCandidate = candidates[0];

    const trail: ReasoningSegment[] = [
      {
        type: "rule",
        label: "Listing criteria",
        text: `Criteria: margin ≥ ${(min_margin * 100).toFixed(0)}%, stock cover ≥ ${min_days_cover}d, ABC class A or B, not yet listed online.`,
      },
      {
        type: "data",
        label: "Candidates found",
        text: `${candidates.length} SKU${candidates.length > 1 ? "s" : ""} meet all criteria (showing top ${Math.min(limit, candidates.length)} by margin, class ${classLabel}).`,
      },
      {
        type: "data",
        label: "Top candidate",
        text: `Best: ${topCandidate.sku} at ${(topCandidate.real_margin_pct * 100).toFixed(1)}% margin, ${Math.floor(topCandidate.days_of_cover)}d cover.`,
      },
      {
        type: "calc",
        label: "Pipeline summary",
        text: `Avg margin ${(avg_margin * 100).toFixed(1)}%, avg cover ${Math.floor(avg_cover)}d across pipeline.`,
      },
      {
        type: "verdict",
        label: "Trigger",
        text: `${candidates.length} high-margin, well-stocked SKU${candidates.length > 1 ? "s" : ""} ready to list. Strong candidates for online revenue with minimal stockout risk.`,
      },
    ];

    return [
      {
        organization_id: orgId,
        rule_type: "ecommerce_pipeline",
        severity: "yellow",
        title: `${candidates.length} SKU${candidates.length > 1 ? "s" : ""} ready for Shopify`,
        summary: `Avg margin ${(avg_margin * 100).toFixed(1)}% · cover ${Math.floor(avg_cover)}d avg · class ${classLabel}`,
        reasoning: segmentsToText(trail),
        suggested_action: "Open pipeline",
        metadata: {
          sku_ids: candidates.map((c) => c.product_id),
          skus: candidates.map((c: Candidate) => ({ id: c.product_id, sku: c.sku, name: c.name, margin: c.real_margin_pct, cover: c.days_of_cover, abc: c.abc_class })),
          avg_margin: Math.round(avg_margin * 1000) / 1000,
          avg_cover: Math.round(avg_cover),
          count: candidates.length,
          reasoning_trail: trail,
        },
      },
    ];
  },
};

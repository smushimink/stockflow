import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";
import { calculatePriceElasticity } from "@/lib/analytics/elasticity";

interface ElasticityPricingConfig {
  confidence_threshold?: number;  // R² minimum, default 0.6
  min_price_diff_pct?: number;    // Ignore if deviation < this, default 0.05
}

export const elasticityPricingRule: DecisionRule = {
  rule_type: "elasticity_pricing",
  defaultConfig: { confidence_threshold: 0.6, min_price_diff_pct: 0.05 },

  async evaluate({ orgId, config }: RuleContext): Promise<Alert[]> {
    const {
      confidence_threshold = 0.6,
      min_price_diff_pct = 0.05,
    } = config as ElasticityPricingConfig;

    const supabase = createAdminClient();

    const { data: products, error } = await supabase
      .from("products")
      .select("id, sku, selling_price, status")
      .eq("organization_id", orgId)
      .eq("status", "active");

    if (error) throw error;

    const alerts: Alert[] = [];

    for (const product of products ?? []) {
      const productId = product.id as string;
      const sku = product.sku as string;
      const currentPrice = product.selling_price as number;

      let result;
      try {
        result = await calculatePriceElasticity(productId);
      } catch {
        continue;
      }

      if (result.classification === "unknown") continue;
      if (result.confidence < confidence_threshold) continue;

      const { recommended_price, expected_profit_at_recommended, baseline_profit } = result;

      const priceDiff = Math.abs(recommended_price - currentPrice) / Math.max(currentPrice, 0.01);
      if (priceDiff <= min_price_diff_pct) continue;

      const isUnderpriced = recommended_price > currentPrice;
      const severity: Alert["severity"] = isUnderpriced ? "orange" : "yellow";

      const dailyLift = expected_profit_at_recommended - baseline_profit;
      const monthlyProfitLift = Math.round(dailyLift * 30 * 100) / 100;
      const liftAbs = Math.abs(monthlyProfitLift);
      const pctChange = ((recommended_price - currentPrice) / currentPrice * 100).toFixed(1);

      // Approximate p-value from R² and N via t-statistic for simple OLS
      // t = r * sqrt(N-2) / sqrt(1 - r²)  where r = sqrt(R²)
      const r = Math.sqrt(result.confidence);
      const n = result.data_points;
      const tStat = n > 2 ? (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-9, 1 - result.confidence)) : 0;
      const pValueLabel =
        tStat > 3.29 ? "p < 0.001" :
        tStat > 2.58 ? "p < 0.01" :
        tStat > 1.96 ? "p < 0.05" :
        "p ≥ 0.05 (not significant)";
      const confidenceLabel =
        result.confidence >= 0.7 ? "high" :
        result.confidence >= 0.4 ? "moderate" :
        "low";
      const volumeImpact10pct = (Math.abs(result.elasticity) * 10).toFixed(1);
      const priceDirection = isUnderpriced ? "increase" : "decrease";
      const volumeDirection = isUnderpriced ? "decrease" : "increase";

      // Period estimate from data points (assumes daily observations)
      const monthsApprox = Math.round(result.data_points / 30 * 10) / 10;
      const periodLabel = monthsApprox >= 1 ? `~${monthsApprox.toFixed(0)} months` : `${result.data_points} days`;

      const trail: ReasoningSegment[] = [
        {
          type: "stat",
          label: "Econometric model",
          text: `Based on ${result.distinct_prices} distinct price points over ${periodLabel} (R² = ${(result.confidence * 100).toFixed(0)}%, ${pValueLabel}, N = ${result.data_points}), this product has elasticity ε = ${result.elasticity.toFixed(2)} (${result.classification.replace(/_/g, " ")}). A 10% price ${priceDirection} predicts a ~${volumeImpact10pct}% volume ${volumeDirection}. Confidence: ${confidenceLabel}.`,
        },
        {
          type: "data",
          label: "Price comparison",
          text: `Current price: $${currentPrice.toFixed(2)}. Profit-maximising price: $${recommended_price.toFixed(2)} (${isUnderpriced ? "+" : ""}${pctChange}%). ${result.insight}`,
        },
        {
          type: "calc",
          label: "Profit model",
          text: `Baseline daily profit at $${currentPrice.toFixed(2)}: $${baseline_profit.toFixed(2)}. Expected daily profit at $${recommended_price.toFixed(2)}: $${expected_profit_at_recommended.toFixed(2)}. Monthly uplift: $${liftAbs.toFixed(0)}.`,
        },
        {
          type: "rule",
          label: "Confidence check",
          text: `R² = ${(result.confidence * 100).toFixed(0)}% ≥ ${(confidence_threshold * 100).toFixed(0)}% threshold. Price deviation ${(priceDiff * 100).toFixed(1)}% > ${(min_price_diff_pct * 100).toFixed(0)}% minimum.`,
        },
        {
          type: "context",
          label: "Risk note",
          text: `Recommended price $${recommended_price.toFixed(2)} is ${isUnderpriced ? "above" : "below"} the observed range centre. Prices far outside $${(currentPrice * 0.85).toFixed(2)}–$${(currentPrice * 1.2).toFixed(2)} have thin data — recommend A/B testing before full rollout.`,
        },
        {
          type: "verdict",
          label: "Trigger",
          text: isUnderpriced
            ? `Current price $${currentPrice.toFixed(2)} is below the profit-maximising price of $${recommended_price.toFixed(2)}. Estimated $${liftAbs.toFixed(0)}/month left on the table.`
            : `Current price $${currentPrice.toFixed(2)} exceeds the profit-maximising price of $${recommended_price.toFixed(2)}. Overpricing likely reduces volume and total profit by ~$${liftAbs.toFixed(0)}/month.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "elasticity_pricing",
        related_product_id: productId,
        severity,
        title: `Pricing opportunity: ${sku}`,
        summary: `Current $${currentPrice.toFixed(2)}. Recommended $${recommended_price.toFixed(2)}. Expected profit lift: +$${liftAbs.toFixed(0)}/month`,
        reasoning: segmentsToText(trail),
        suggested_action: "Run price test",
        suggested_value: recommended_price,
        metadata: {
          sku,
          current_price: currentPrice,
          recommended_price,
          monthly_profit_lift: monthlyProfitLift,
          price_diff_pct: Math.round(priceDiff * 10000) / 100,
          elasticity: result.elasticity,
          classification: result.classification,
          confidence: result.confidence,
          data_points: result.data_points,
          distinct_prices: result.distinct_prices,
          expected_units_at_recommended: result.expected_units_at_recommended,
          expected_profit_at_recommended,
          baseline_profit,
          unit_cost: result.unit_cost,
          test_duration_days: 14,
          reasoning_trail: trail,
          elasticity_result: {
            elasticity: result.elasticity,
            classification: result.classification,
            confidence: result.confidence,
            data_points: result.data_points,
            distinct_prices: result.distinct_prices,
            recommended_price: result.recommended_price,
            expected_units_at_recommended: result.expected_units_at_recommended,
            expected_profit_at_recommended: result.expected_profit_at_recommended,
            baseline_profit: result.baseline_profit,
            unit_cost: result.unit_cost,
            current_price: result.current_price,
            insight: result.insight,
          },
        },
      });
    }

    // Orange (underpriced, leaving money on table) first; within group sort by lift desc
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "orange" ? -1 : 1;
      return Math.abs(b.metadata.monthly_profit_lift as number) - Math.abs(a.metadata.monthly_profit_lift as number);
    });

    return alerts;
  },
};

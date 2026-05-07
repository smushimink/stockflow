// Canonical threshold definitions for every rule.
// Used by ThresholdEdit, the rules page, and action cards.

export type ThresholdFormat = "multiplier" | "days" | "percent" | "currency" | "units";

export interface ThresholdDef {
  key: string;
  label: string;
  format: ThresholdFormat;
  min: number;
  max: number;
  step: number;
  helpText?: string;
  default: number;
}

export interface RuleMeta {
  label: string;
  description: string;
  thresholds: ThresholdDef[];
}

export const RULE_SCHEMAS: Record<string, RuleMeta> = {
  reorder: {
    label: "01 Reorder point",
    description: "Alert when stock falls below reorder threshold",
    thresholds: [
      { key: "safety_factor", label: "Safety factor", format: "multiplier", min: 1.0, max: 3.0, step: 0.1, default: 1.3, helpText: "Stock buffer multiplier (1.3× = 30% extra above lead-time demand)" },
      { key: "target_cover_days", label: "Target cover", format: "days", min: 7, max: 90, step: 1, default: 30, helpText: "Days of stock to hold after ordering" },
    ],
  },
  dead_stock: {
    label: "02 Dead stock",
    description: "Flag inventory with no sales for N days",
    thresholds: [
      { key: "yellow_days", label: "Monitor after", format: "days", min: 7, max: 365, step: 1, default: 60, helpText: "Days idle before yellow alert" },
      { key: "orange_days", label: "Action after", format: "days", min: 7, max: 365, step: 1, default: 90, helpText: "Days idle before orange alert" },
      { key: "red_days", label: "Urgent after", format: "days", min: 7, max: 365, step: 1, default: 180, helpText: "Days idle before red (likely write-off)" },
    ],
  },
  abc_classification: {
    label: "03 ABC classification",
    description: "Classify products by revenue contribution",
    thresholds: [
      { key: "a_threshold", label: "Class A cutoff", format: "percent", min: 0.5, max: 0.95, step: 0.05, default: 0.7, helpText: "Top X% revenue → Class A" },
      { key: "b_threshold", label: "Class B cutoff", format: "percent", min: 0.3, max: 0.8, step: 0.05, default: 0.9, helpText: "Next tier to Class B (remainder = C)" },
    ],
  },
  real_margin: {
    label: "04 Real margin",
    description: "Alert when actual margin drops below threshold",
    thresholds: [
      { key: "yellow_threshold", label: "Monitor margin", format: "percent", min: 0.01, max: 1.0, step: 0.01, default: 0.25, helpText: "Margin below this → yellow alert" },
      { key: "red_threshold", label: "Urgent margin", format: "percent", min: 0.01, max: 1.0, step: 0.01, default: 0.15, helpText: "Margin below this → red alert" },
    ],
  },
  customer_churn: {
    label: "05 Customer churn",
    description: "Flag customers overdue for their next order",
    thresholds: [
      { key: "churn_factor", label: "Churn factor", format: "multiplier", min: 1.0, max: 5.0, step: 0.1, default: 1.5, helpText: "Alert if days since last order exceeds avg interval × factor" },
      { key: "min_orders", label: "Min orders", format: "units", min: 1, max: 20, step: 1, default: 3, helpText: "Minimum order count to qualify for churn monitoring" },
    ],
  },
  supplier_scorecard: {
    label: "06 Supplier scorecard",
    description: "Flag suppliers with poor delivery or fill rates",
    thresholds: [
      { key: "on_time_rate_threshold", label: "Min on-time rate", format: "percent", min: 0.1, max: 1.0, step: 0.05, default: 0.8, helpText: "On-time rate below this triggers alert" },
      { key: "fill_rate_threshold", label: "Min fill rate", format: "percent", min: 0.1, max: 1.0, step: 0.05, default: 0.9, helpText: "Fill rate below this triggers alert" },
      { key: "lead_time_variance_threshold", label: "Lead time variance", format: "multiplier", min: 1.0, max: 3.0, step: 0.1, default: 1.3, helpText: "Alert if actual lead time exceeds promised by this factor" },
    ],
  },
  ecommerce_pipeline: {
    label: "07 E-commerce pipeline",
    description: "Surface SKUs ready to list online",
    thresholds: [
      { key: "min_margin", label: "Min margin to list", format: "percent", min: 0.01, max: 1.0, step: 0.01, default: 0.2, helpText: "Minimum margin required before recommending online listing" },
      { key: "min_cover_days", label: "Min cover days", format: "days", min: 7, max: 90, step: 1, default: 14, helpText: "Must have this many days of stock before listing" },
    ],
  },
  seasonal_preorder: {
    label: "08 Seasonal pre-order",
    description: "Plan ahead for seasonal demand spikes",
    thresholds: [
      { key: "warning_days", label: "Plan ahead", format: "days", min: 14, max: 180, step: 7, default: 90, helpText: "Days before season start to begin planning" },
      { key: "critical_days", label: "Order by", format: "days", min: 7, max: 90, step: 7, default: 60, helpText: "Days before season for urgent alert" },
      { key: "growth_factor", label: "Growth factor", format: "multiplier", min: 1.0, max: 2.0, step: 0.05, default: 1.1, helpText: "Expected YoY demand growth" },
    ],
  },
  customer_profitability: {
    label: "09 Customer profitability",
    description: "Flag low-margin customers and slow payers",
    thresholds: [
      { key: "low_margin_threshold", label: "Low margin alert", format: "percent", min: 0.01, max: 1.0, step: 0.01, default: 0.15, helpText: "Customer effective margin below this → alert" },
      { key: "high_value_threshold", label: "High-value threshold", format: "currency", min: 500, max: 50000, step: 500, default: 5000, helpText: "90-day revenue above this = high-value customer" },
      { key: "payment_warning_ratio", label: "Payment warning", format: "multiplier", min: 1.0, max: 3.0, step: 0.1, default: 1.3, helpText: "Flag if actual payment days exceed terms × ratio" },
    ],
  },
  elasticity_pricing: {
    label: "10 Elasticity pricing",
    description: "Flag pricing opportunities using demand elasticity model",
    thresholds: [
      { key: "confidence_threshold", label: "Min model confidence", format: "percent", min: 0.3, max: 0.95, step: 0.05, default: 0.6, helpText: "R² below this → skip (model not reliable enough)" },
      { key: "min_price_diff_pct", label: "Min price deviation", format: "percent", min: 0.01, max: 0.3, step: 0.01, default: 0.05, helpText: "Only alert if recommended price differs by more than this %" },
    ],
  },
};

// Subset shown on action cards for each rule type (the ones that directly influence the alert)
export const ACTION_CARD_THRESHOLDS: Record<string, string[]> = {
  reorder:              ["safety_factor", "target_cover_days"],
  dead_stock:           ["yellow_days", "orange_days", "red_days"],
  real_margin:          ["yellow_threshold", "red_threshold"],
  customer_churn:       ["churn_factor"],
  supplier_scorecard:   ["on_time_rate_threshold", "fill_rate_threshold"],
  seasonal_preorder:    ["warning_days", "critical_days"],
  customer_profitability: ["low_margin_threshold"],
};

// Canonical default config value for a given rule + key
export function getDefaultThresholdValue(ruleType: string, key: string): number | null {
  return RULE_SCHEMAS[ruleType]?.thresholds.find((t) => t.key === key)?.default ?? null;
}

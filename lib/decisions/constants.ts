export const RULE_TYPES = {
  REORDER: "reorder",
  DEAD_STOCK: "dead_stock",
  ABC_CLASSIFICATION: "abc_classification",
  REAL_MARGIN: "real_margin",
  CUSTOMER_CHURN: "customer_churn",
  SUPPLIER_SCORECARD: "supplier_scorecard",
  ECOMMERCE_PIPELINE: "ecommerce_pipeline",
  SEASONAL_PREORDER: "seasonal_preorder",
} as const;

export type RuleType = (typeof RULE_TYPES)[keyof typeof RULE_TYPES];

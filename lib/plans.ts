export type PlanId = "free" | "starter" | "pro" | "business";

export const PLAN_LIMITS = {
  free: {
    label: "Free",
    maxSkus: 50,
    maxRules: 3,
    xeroMyob: false,
    apiAccess: false,
    customRules: false,
    prioritySupport: false,
  },
  starter: {
    label: "Starter",
    maxSkus: 500,
    maxRules: 5,
    xeroMyob: false,
    apiAccess: false,
    customRules: false,
    prioritySupport: false,
  },
  pro: {
    label: "Pro",
    maxSkus: 5000,
    maxRules: 10,
    xeroMyob: true,
    apiAccess: false,
    customRules: false,
    prioritySupport: true,
  },
  business: {
    label: "Business",
    maxSkus: Infinity,
    maxRules: 10,
    xeroMyob: true,
    apiAccess: true,
    customRules: true,
    prioritySupport: true,
  },
} as const satisfies Record<PlanId, {
  label: string;
  maxSkus: number;
  maxRules: number;
  xeroMyob: boolean;
  apiAccess: boolean;
  customRules: boolean;
  prioritySupport: boolean;
}>;

export type PlanLimits = typeof PLAN_LIMITS[PlanId];

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

// Rule types ordered by priority — first N are unlocked on a given plan
export const RULE_PRIORITY_ORDER = [
  "reorder",
  "dead_stock",
  "real_margin",
  "customer_churn",
  "abc_classification",
  "supplier_scorecard",
  "seasonal_preorder",
  "customer_profitability",
  "ecommerce_pipeline",
  "elasticity_pricing",
] as const;

export type RuleType = typeof RULE_PRIORITY_ORDER[number];

export function ruleIndexForPlan(ruleType: string, plan: PlanId): "allowed" | "locked" {
  const idx = RULE_PRIORITY_ORDER.indexOf(ruleType as RuleType);
  if (idx === -1) return "allowed";
  return idx < getPlanLimits(plan).maxRules ? "allowed" : "locked";
}

export const UPGRADE_URL = "/pricing";

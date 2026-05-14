type Feature = "multi_user" | "analytics" | "custom_rules" | "unlimited_skus";

const GATES: Record<string, Record<Feature, boolean>> = {
  free:     { multi_user: false, analytics: false, custom_rules: false, unlimited_skus: false },
  starter:  { multi_user: false, analytics: false, custom_rules: false, unlimited_skus: false },
  pro:      { multi_user: true,  analytics: true,  custom_rules: true,  unlimited_skus: false },
  business: { multi_user: true,  analytics: true,  custom_rules: true,  unlimited_skus: true  },
};

export function canUseFeature(plan: string, feature: Feature): boolean {
  return GATES[plan]?.[feature] ?? false;
}

import { recalculateAbcClassification } from "@/lib/metrics/calculator";
import type { Alert, DecisionRule } from "@/lib/decisions/types";

// This rule runs the ABC recalculation as a side effect and emits no alerts.
// Its purpose is to keep abc_class fresh when the engine runs on a schedule.
export const abcRule: DecisionRule = {
  rule_type: "abc_classification",
  defaultConfig: { a_threshold: 0.8, b_threshold: 0.95 },

  async evaluate(orgId: string, _config: Record<string, unknown>): Promise<Alert[]> {
    await recalculateAbcClassification(orgId);
    return [];
  },
};

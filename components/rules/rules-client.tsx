"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DecisionRule } from "@/lib/supabase/types";
import { recalculateMetrics } from "@/app/(dashboard)/rules/recalculate/action";

const RULE_META: Record<string, { label: string; description: string; configurable: boolean }> = {
  reorder: { label: "01 Reorder point", description: "Alert when stock falls below minimum threshold", configurable: false },
  dead_stock: { label: "02 Dead stock", description: "Flag inventory with no sales for N days", configurable: true },
  abc_classification: { label: "03 ABC classification", description: "Classify products by revenue contribution (quarterly)", configurable: false },
  real_margin: { label: "04 Real margin", description: "Alert when actual margin drops below threshold", configurable: false },
  customer_churn: { label: "05 Customer churn", description: "Flag customers who may be at risk of leaving", configurable: false },
  supplier_scorecard: { label: "06 Supplier scorecard", description: "Flag suppliers with poor delivery or fill rates", configurable: false },
  ecommerce_pipeline: { label: "07 E-commerce pipeline", description: "Surface SKUs ready to list online", configurable: false },
  seasonal_preorder: { label: "08 Seasonal pre-order", description: "Plan ahead for seasonal demand spikes", configurable: false },
};

interface RulesClientProps {
  rules: DecisionRule[];
  orgId: string;
}

export function RulesClient({ rules, orgId }: RulesClientProps) {
  const [ruleStates, setRuleStates] = useState<Record<string, DecisionRule>>(
    Object.fromEntries(rules.map((r) => [r.rule_type, r]))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const supabase = createClient();

  async function toggleRule(ruleType: string, enabled: boolean) {
    const rule = ruleStates[ruleType];
    if (!rule) return;

    setRuleStates((prev) => ({ ...prev, [ruleType]: { ...prev[ruleType], enabled } }));

    await supabase
      .from("decision_rules")
      .update({ enabled })
      .eq("id", rule.id);
  }

  async function saveConfig(ruleType: string, config: Record<string, unknown>) {
    const rule = ruleStates[ruleType];
    if (!rule) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRuleStates((prev) => ({ ...prev, [ruleType]: { ...prev[ruleType], config: config as any } }));

    await supabase
      .from("decision_rules")
      .update({ config })
      .eq("id", rule.id);
  }

  async function runAllRules() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/cron/morning-alerts", {
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "dev"}` },
    });
    const data = await res.json();
    setRunResult(`Ran for ${data.processed} org(s). ${data.results?.[0]?.newAlerts ?? 0} new alerts.`);
    setRunning(false);
  }

  async function handleRecalculate() {
    setRecalculating(true);
    const toastId = toast.loading("Recalculating metrics…");
    const result = await recalculateMetrics();
    if ("error" in result) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success(
        `Done in ${result.duration_ms}ms · ${result.products_updated} products · ${result.abc_updated} ABC classified · ${result.customers_updated} customers`,
        { id: toastId, duration: 6000 }
      );
    }
    setRecalculating(false);
  }

  const orderedRules = Object.keys(RULE_META).map((key) => ruleStates[key]).filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#6B6B66]">{orderedRules.length} rules configured</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw size={10} className={recalculating ? "animate-spin" : ""} />
            {recalculating ? "Recalculating…" : "Recalculate metrics"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={runAllRules}
            disabled={running}
            className="h-7 text-xs gap-1.5"
          >
            <Play size={10} />
            {running ? "Running..." : "Run all now"}
          </Button>
        </div>
      </div>

      {runResult && (
        <div className="px-3 py-2 bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded text-xs text-[#4D7B3D] mb-3">
          {runResult}
        </div>
      )}

      {orderedRules.map((rule) => {
        const meta = RULE_META[rule.rule_type];
        if (!meta) return null;
        const isExpanded = expanded === rule.rule_type;

        return (
          <div
            key={rule.rule_type}
            className={cn(
              "border rounded-lg bg-white transition-all",
              rule.enabled ? "border-[#E5E5E2]" : "border-[#E5E5E2] opacity-60"
            )}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => toggleRule(rule.rule_type, v)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-[#1A1A17]">{meta.label}</p>
                <p className="text-xs text-[#6B6B66] truncate">{meta.description}</p>
              </div>
              {meta.configurable && (
                <button
                  onClick={() => setExpanded(isExpanded ? null : rule.rule_type)}
                  className="p-1 rounded hover:bg-[#F7F7F5] text-[#6B6B66] transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>

            {isExpanded && rule.rule_type === "dead_stock" && (
              <DeadStockConfig
                config={rule.config as Record<string, unknown>}
                onSave={(config) => saveConfig(rule.rule_type, config)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeadStockConfig({
  config,
  onSave,
}: {
  config: Record<string, unknown>;
  onSave: (c: Record<string, unknown>) => void;
}) {
  const [yellow, setYellow] = useState(String(config.yellow_days ?? 60));
  const [orange, setOrange] = useState(String(config.orange_days ?? 90));
  const [red, setRed] = useState(String(config.red_days ?? 180));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave({
      yellow_days: Number(yellow),
      orange_days: Number(orange),
      red_days: Number(red),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="px-4 pb-4 pt-2 border-t border-[#E5E5E2] space-y-3">
      <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Thresholds (days since last sale)</p>
      <div className="grid grid-cols-3 gap-3">
        <ThresholdInput label="Monitor" color="#B47214" value={yellow} onChange={setYellow} />
        <ThresholdInput label="This week" color="#B47214" value={orange} onChange={setOrange} />
        <ThresholdInput label="Urgent" color="#C54632" value={red} onChange={setRed} />
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        className="h-7 text-xs bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
      >
        {saved ? "Saved!" : "Save thresholds"}
      </Button>
    </div>
  );
}

function ThresholdInput({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <p className="text-xs text-[#6B6B66]">{label}</p>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 text-sm tabular-nums border border-[#E5E5E2] rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
          min="1"
          max="365"
        />
        <span className="text-xs text-[#6B6B66]">days</span>
      </div>
    </div>
  );
}

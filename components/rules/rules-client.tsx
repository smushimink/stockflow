"use client";

import { useState, useTransition } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp, Play, RefreshCw, SlidersHorizontal, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DecisionRule } from "@/lib/supabase/types";
import { recalculateMetrics } from "@/app/(dashboard)/rules/recalculate/action";
import { createClient } from "@/lib/supabase/client";
import { ThresholdEdit, formatThreshold } from "@/components/shared/threshold-edit";
import { previewThreshold, getThresholdHistory } from "@/app/(dashboard)/rules/actions";
import type { ThresholdChange } from "@/app/(dashboard)/rules/actions";
import { RULE_SCHEMAS } from "@/lib/decisions/rule-schemas";
import { ruleIndexForPlan, getPlanLimits, UPGRADE_URL } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";
import { Lock } from "lucide-react";

interface RulesClientProps {
  rules: DecisionRule[];
  orgId: string;
  plan?: PlanId;
}

type Panel = "config" | "calibrate" | "history";

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ ruleType, onClose }: { ruleType: string; onClose: () => void }) {
  const [history, setHistory] = useState<ThresholdChange[] | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    getThresholdHistory(ruleType).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  });

  return (
    <div className="px-4 pb-4 pt-2 border-t border-[#E5E5E2] space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Change history</p>
        <button onClick={onClose} className="text-[#6B6B66] hover:text-[#1A1A17] transition-colors"><X size={14} /></button>
      </div>
      {loading && <p className="text-xs text-[#6B6B66]">Loading…</p>}
      {!loading && history?.length === 0 && (
        <p className="text-xs text-[#6B6B66]">No changes recorded yet.</p>
      )}
      {history && history.length > 0 && (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-3 text-xs border-b border-[#F0F0EE] pb-2 last:border-0">
              <div className="flex-1">
                <span className="font-500 text-[#1A1A17]">{h.configKey}</span>
                <span className="text-[#6B6B66]"> changed{h.oldValue ? ` from ${h.oldValue}` : ""} to </span>
                <span className="font-500 text-[#1A1A17]">{h.newValue}</span>
              </div>
              <span className="text-[#C8C8C4] shrink-0 tabular-nums">
                {new Date(h.changedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calibrate panel ───────────────────────────────────────────────────────────

function CalibratePanel({ ruleType, config, onClose }: { ruleType: string; config: Record<string, unknown>; onClose: () => void }) {
  const schema = RULE_SCHEMAS[ruleType];
  const [isPending, startTransition] = useTransition();
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of schema?.thresholds ?? []) {
      init[t.key] = (config[t.key] as number | undefined) ?? t.default;
    }
    return init;
  });
  const [preview, setPreview] = useState<{ total: number } | null>(null);

  if (!schema) return null;

  function handlePreview() {
    startTransition(async () => {
      const result = await previewThreshold(ruleType, sliderValues);
      if (result.error) toast.error(result.error);
      else setPreview({ total: result.total ?? 0 });
    });
  }

  return (
    <div className="px-4 pb-4 pt-2 border-t border-[#E5E5E2] space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Calibrate thresholds</p>
        <button onClick={onClose} className="text-[#6B6B66] hover:text-[#1A1A17] transition-colors"><X size={14} /></button>
      </div>
      <p className="text-xs text-[#6B6B66]">
        Drag sliders to explore. Hit &ldquo;Preview&rdquo; to see how many alerts this config would generate — without saving.
      </p>

      <div className="space-y-4">
        {schema.thresholds.map((t) => {
          const stored = sliderValues[t.key] ?? t.default;
          const display = t.format === "percent" ? stored * 100 : stored;
          const dispMin = t.format === "percent" ? t.min * 100 : t.min;
          const dispMax = t.format === "percent" ? t.max * 100 : t.max;
          const dispStep = t.format === "percent" ? (t.step ?? 1) * 100 : (t.step ?? 1);

          return (
            <div key={t.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#6B6B66]">{t.label}</span>
                <span className="font-600 text-[#1A1A17] tabular-nums">{formatThreshold(stored, t.format)}</span>
              </div>
              <input
                type="range"
                min={dispMin}
                max={dispMax}
                step={dispStep}
                value={display}
                onChange={(e) => {
                  const dispVal = parseFloat(e.target.value);
                  const storedVal = t.format === "percent" ? dispVal / 100 : dispVal;
                  setSliderValues((prev) => ({ ...prev, [t.key]: storedVal }));
                  setPreview(null);
                }}
                className="w-full accent-[#1A1A17]"
              />
              {t.helpText && <p className="text-[10px] text-[#C8C8C4]">{t.helpText}</p>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreview}
          disabled={isPending}
          className="h-7 text-xs gap-1.5"
        >
          <Play size={10} />
          {isPending ? "Previewing…" : "Preview"}
        </Button>
        {preview && (
          <p className="text-xs text-[#1A1A17] font-500">
            {preview.total} alert{preview.total !== 1 ? "s" : ""} would be generated
          </p>
        )}
      </div>
      <p className="text-[10px] text-[#6B6B66]">
        To apply changes, click each number above directly — inline editing saves and re-runs instantly.
      </p>
    </div>
  );
}

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({ ruleType, config, onThresholdSaved }: {
  ruleType: string;
  config: Record<string, unknown>;
  onThresholdSaved: (key: string, value: number) => void;
}) {
  const schema = RULE_SCHEMAS[ruleType];
  if (!schema?.thresholds.length) {
    return (
      <div className="px-4 pb-4 pt-2 border-t border-[#E5E5E2]">
        <p className="text-xs text-[#6B6B66]">No configurable thresholds for this rule.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-3 border-t border-[#E5E5E2] space-y-3">
      <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Thresholds — click a value to edit</p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {schema.thresholds.map((t) => {
          const currentValue = (config[t.key] as number | undefined) ?? t.default;
          return (
            <div key={t.key} className="space-y-0.5">
              <p className="text-[10px] text-[#6B6B66] uppercase tracking-wider">{t.label}</p>
              <ThresholdEdit
                ruleType={ruleType}
                configKey={t.key}
                value={currentValue}
                format={t.format}
                min={t.min}
                max={t.max}
                step={t.step}
                helpText={t.helpText}
                onSaved={(v) => onThresholdSaved(t.key, v)}
              />
              {t.helpText && <p className="text-[9px] text-[#C8C8C4] max-w-[120px] leading-tight">{t.helpText}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RulesClient({ rules, orgId, plan = "starter" }: RulesClientProps) {
  const planLimits = getPlanLimits(plan);
  const [ruleStates, setRuleStates] = useState<Record<string, DecisionRule>>(
    Object.fromEntries(rules.map((r) => [r.rule_type, r]))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Record<string, Panel>>({});
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const supabase = createClient();

  function getPanel(ruleType: string): Panel | null {
    return expanded === ruleType ? (activePanel[ruleType] ?? "config") : null;
  }

  function togglePanel(ruleType: string, panel: Panel) {
    if (expanded === ruleType && getPanel(ruleType) === panel) {
      setExpanded(null);
    } else {
      setExpanded(ruleType);
      setActivePanel((prev) => ({ ...prev, [ruleType]: panel }));
    }
  }

  function handleThresholdSaved(ruleType: string, key: string, value: number) {
    setRuleStates((prev) => {
      const rule = prev[ruleType];
      if (!rule) return prev;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newConfig = { ...(rule.config as Record<string, unknown>), [key]: value } as any;
      return { ...prev, [ruleType]: { ...rule, config: newConfig } };
    });
  }

  async function toggleRule(ruleType: string, enabled: boolean) {
    setRuleStates((prev) => ({ ...prev, [ruleType]: { ...prev[ruleType], enabled } }));
    await supabase.from("decision_rules").update({ enabled }).eq("organization_id", orgId).eq("rule_type", ruleType);
  }

  async function runAllRules() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/cron/morning-alerts", {
      headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "dev"}` },
    });
    const data = await res.json();
    setRunResult(`${data.results?.[0]?.newAlerts ?? 0} new alerts · ${data.results?.[0]?.total ?? 0} total active.`);
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
        `Done in ${result.duration_ms}ms · ${result.products_updated} products · ${result.abc_updated} ABC · ${result.customers_updated} customers`,
        { id: toastId, duration: 6000 }
      );
    }
    setRecalculating(false);
  }

  const orderedRules = Object.keys(RULE_SCHEMAS)
    .map((key) => ruleStates[key])
    .filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#6B6B66]">
          {orderedRules.length} rules · {planLimits.maxRules} active on {planLimits.label} plan · click any value to edit inline
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={recalculating} className="h-7 text-xs gap-1.5">
            <RefreshCw size={10} className={recalculating ? "animate-spin" : ""} />
            {recalculating ? "Recalculating…" : "Recalculate"}
          </Button>
          <Button size="sm" variant="outline" onClick={runAllRules} disabled={running} className="h-7 text-xs gap-1.5">
            <Play size={10} />
            {running ? "Running…" : "Run all"}
          </Button>
        </div>
      </div>

      {runResult && (
        <div className="px-3 py-2 bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded text-xs text-[#4D7B3D] mb-3">
          {runResult}
        </div>
      )}

      {orderedRules.map((rule) => {
        const schema = RULE_SCHEMAS[rule.rule_type];
        if (!schema) return null;
        const panel = getPanel(rule.rule_type);
        const ruleConfig = (rule.config ?? {}) as Record<string, unknown>;
        const hasThresholds = schema.thresholds.length > 0;
        const isPlanLocked = ruleIndexForPlan(rule.rule_type, plan) === "locked";

        if (isPlanLocked) {
          return (
            <div
              key={rule.rule_type}
              className="border border-[#F0F0EE] rounded-lg bg-[#FAFAF8] flex items-center gap-3 px-4 py-3 opacity-70"
            >
              <div className="w-9 h-5 flex items-center justify-center shrink-0">
                <Lock size={14} className="text-[#C8C8C4]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-[#6B6B66]">{schema.label}</p>
                <p className="text-xs text-[#9A9A93] truncate">{schema.description}</p>
              </div>
              <a
                href={UPGRADE_URL}
                className="shrink-0 px-2.5 py-1 rounded text-[10px] font-600 uppercase tracking-wide bg-[#F0F0EE] text-[#6B6B66] hover:bg-[#E5E5E2] transition-colors"
              >
                {plan === "starter" || plan === "free" ? "Pro" : "Upgrade"}
              </a>
            </div>
          );
        }

        return (
          <div
            key={rule.rule_type}
            className={cn(
              "border rounded-lg bg-white transition-all",
              rule.enabled ? "border-[#E5E5E2]" : "border-[#E5E5E2] opacity-60"
            )}
          >
            {/* Rule header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => toggleRule(rule.rule_type, v)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-[#1A1A17]">{schema.label}</p>
                <p className="text-xs text-[#6B6B66] truncate">{schema.description}</p>
              </div>

              {/* Inline threshold preview */}
              {hasThresholds && (
                <div className="hidden sm:flex items-center gap-3 flex-wrap">
                  {schema.thresholds.slice(0, 3).map((t) => {
                    const currentValue = (ruleConfig[t.key] as number | undefined) ?? t.default;
                    return (
                      <ThresholdEdit
                        key={t.key}
                        ruleType={rule.rule_type}
                        configKey={t.key}
                        value={currentValue}
                        format={t.format}
                        min={t.min}
                        max={t.max}
                        step={t.step}
                        label={t.label}
                        helpText={t.helpText}
                        onSaved={(v) => handleThresholdSaved(rule.rule_type, t.key, v)}
                      />
                    );
                  })}
                </div>
              )}

              {hasThresholds && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePanel(rule.rule_type, "config")}
                    title="Configure"
                    className={cn(
                      "p-1.5 rounded hover:bg-[#F7F7F5] transition-colors",
                      panel === "config" ? "bg-[#F0F0EE] text-[#1A1A17]" : "text-[#6B6B66]"
                    )}
                  >
                    {panel === "config" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => togglePanel(rule.rule_type, "calibrate")}
                    title="Calibrate"
                    className={cn(
                      "p-1.5 rounded hover:bg-[#F7F7F5] transition-colors",
                      panel === "calibrate" ? "bg-[#F0F0EE] text-[#1A1A17]" : "text-[#6B6B66]"
                    )}
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                  <button
                    onClick={() => togglePanel(rule.rule_type, "history")}
                    title="History"
                    className={cn(
                      "p-1.5 rounded hover:bg-[#F7F7F5] transition-colors",
                      panel === "history" ? "bg-[#F0F0EE] text-[#1A1A17]" : "text-[#6B6B66]"
                    )}
                  >
                    <History size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Config panel */}
            {panel === "config" && (
              <ConfigPanel
                ruleType={rule.rule_type}
                config={ruleConfig}
                onThresholdSaved={(key, value) => handleThresholdSaved(rule.rule_type, key, value)}
              />
            )}

            {/* Calibrate panel */}
            {panel === "calibrate" && (
              <CalibratePanel
                ruleType={rule.rule_type}
                config={ruleConfig}
                onClose={() => setExpanded(null)}
              />
            )}

            {/* History panel */}
            {panel === "history" && (
              <HistoryPanel
                ruleType={rule.rule_type}
                onClose={() => setExpanded(null)}
              />
            )}
          </div>
        );
      })}

      {/* Help note */}
      <p className="text-xs text-[#C8C8C4] text-center pt-2">
        Click any threshold value (×, d, %) to edit it inline. Changes re-run the rule immediately.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickPoSheet } from "@/components/purchases/quick-po-sheet";
import type { AlertWithProduct } from "@/lib/decisions/types";
import { calcPoBreakEven, calcDiscountBreakEven } from "@/lib/analytics/break-even";
import { ThresholdEdit } from "@/components/shared/threshold-edit";
import { RULE_SCHEMAS, ACTION_CARD_THRESHOLDS } from "@/lib/decisions/rule-schemas";
import { ReasoningTrail } from "@/components/shared/reasoning-trail";

const severityConfig = {
  red: {
    dot: "bg-[#C54632]",
    bg: "bg-[#FDF2F0]",
    border: "border-[#C54632]/20",
  },
  orange: {
    dot: "bg-[#B47214]",
    bg: "bg-[#FDF8EE]",
    border: "border-[#B47214]/20",
  },
  yellow: {
    dot: "bg-[#B47214]",
    bg: "bg-white",
    border: "border-[#E5E5E2]",
  },
  green: {
    dot: "bg-[#4D7B3D]",
    bg: "bg-[#F2F8F0]",
    border: "border-[#4D7B3D]/20",
  },
};

const SNOOZE_OPTIONS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

// ── Econometrics block ────────────────────────────────────────────────────────

function EconometricsBlock({ alert }: { alert: AlertWithProduct }) {
  if (alert.rule_type !== "elasticity_pricing") return null;

  const meta = alert.metadata;
  const elasticity = meta.elasticity as number | undefined;
  const r2 = meta.confidence as number | undefined;
  const dataPoints = meta.data_points as number | undefined;
  const distinctPrices = meta.distinct_prices as number | undefined;
  const currentPrice = meta.current_price as number | undefined;
  const recommendedPrice = meta.recommended_price as number | undefined;
  const monthlyLift = meta.monthly_profit_lift as number | undefined;
  const unitCost = meta.unit_cost as number | undefined;

  if (!elasticity || !r2 || !dataPoints) return null;

  const r = Math.sqrt(r2);
  const n = dataPoints;
  const tStat = n > 2 ? (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-9, 1 - r2)) : 0;
  const pLabel =
    tStat > 3.29 ? "p < 0.001" :
    tStat > 2.58 ? "p < 0.01" :
    tStat > 1.96 ? "p < 0.05" : "p ≥ 0.05";
  const confLabel = r2 >= 0.7 ? "High" : r2 >= 0.4 ? "Moderate" : "Low";
  const confColor = r2 >= 0.7 ? "text-[#4D7B3D]" : r2 >= 0.4 ? "text-[#B47214]" : "text-[#C54632]";
  const absE = Math.abs(elasticity);
  const vol10 = (absE * 10).toFixed(1);
  const isUnder = (recommendedPrice ?? 0) > (currentPrice ?? 0);
  const monthsApprox = Math.round(n / 30);
  const periodLabel = monthsApprox >= 1 ? `${monthsApprox} month${monthsApprox !== 1 ? "s" : ""}` : `${n} days`;

  return (
    <div className="bg-[#F0ECFA] border border-[#5B3FA8]/15 rounded-md px-3 py-2.5 space-y-2.5">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#5B3FA8]">
        Econometric model — show your work
      </p>

      {/* Narrative paragraph */}
      <p className="text-xs text-[#1A1A17] leading-relaxed">
        Based on{" "}
        <strong>{distinctPrices ?? "?"} distinct price points</strong> over {periodLabel} (
        <strong>R² = {(r2 * 100).toFixed(0)}%</strong>, <strong>{pLabel}</strong>, N = {n}), this
        product has elasticity{" "}
        <strong>ε = {elasticity.toFixed(2)}</strong> (
        {elasticity < -2.5
          ? "highly elastic"
          : elasticity < -1.2
          ? "elastic"
          : elasticity < -0.5
          ? "unit elastic"
          : "inelastic"}
        ). A 10% price {isUnder ? "increase" : "decrease"} predicts a ~
        <strong>{vol10}% volume {isUnder ? "drop" : "gain"}</strong>.
      </p>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/70 rounded px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider font-600 text-[#6B6B66]">Confidence</p>
          <p className={`text-sm font-600 ${confColor}`}>{confLabel}</p>
          <p className="text-[10px] text-[#6B6B66]">R² = {(r2 * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-white/70 rounded px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider font-600 text-[#6B6B66]">Monthly lift</p>
          <p className="text-sm font-600 text-[#4D7B3D]">
            {monthlyLift != null ? `+${formatCurrency(Math.abs(monthlyLift))}` : "—"}
          </p>
          <p className="text-[10px] text-[#6B6B66]">if price adjusted</p>
        </div>
        <div className="bg-white/70 rounded px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wider font-600 text-[#6B6B66]">Breakeven cost</p>
          <p className="text-sm font-600 text-[#1A1A17]">
            {unitCost != null ? formatCurrency(unitCost) : "—"}
          </p>
          <p className="text-[10px] text-[#6B6B66]">unit cost floor</p>
        </div>
      </div>

      {/* Risk note */}
      <p className="text-[10px] text-[#6B6B66] leading-relaxed border-t border-[#5B3FA8]/10 pt-2">
        <span className="font-600 text-[#B47214]">Risk:</span> Prices far outside the{" "}
        {currentPrice != null
          ? `$${(currentPrice * 0.85).toFixed(2)}–$${(currentPrice * 1.2).toFixed(2)}`
          : "observed"}{" "}
        range have thin data. Recommend A/B testing the recommended ${recommendedPrice?.toFixed(2)} over
        14 days before full rollout. Use the snooze button if running a test now.
      </p>
    </div>
  );
}

// ── Break-even block ─────────────────────────────────────────────────────────

function BreakEvenBlock({ alert }: { alert: AlertWithProduct }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (Array.isArray(alert.products) ? (alert.products as any[])[0] : alert.products) as {
    unit_cost?: number; selling_price?: number; stock_on_hand?: number;
  } | null | undefined;
  const meta = alert.metadata;

  if (alert.rule_type === "reorder") {
    const qty = alert.suggested_qty;
    const unitCost = (p?.unit_cost ?? 0) as number;
    const sellingPrice = (p?.selling_price ?? 0) as number;
    const avgDaily = (meta.avg_daily_sales as number) ?? 0;
    if (!qty || sellingPrice <= unitCost || avgDaily <= 0) return null;

    const margin = sellingPrice - unitCost;
    const totalCost = qty * unitCost;
    const unitsToBreakEven = Math.ceil(totalCost / margin);
    const daysToBreakEven = avgDaily > 0 ? unitsToBreakEven / avgDaily : null;
    const leadTime = (meta.lead_time_days as number) ?? 14;

    const risk =
      daysToBreakEven === null ? "high"
      : daysToBreakEven < leadTime * 2 ? "low"
      : daysToBreakEven < leadTime * 4 ? "medium"
      : "high";

    const riskColor = { low: "text-[#4D7B3D]", medium: "text-[#B47214]", high: "text-[#C54632]" }[risk];

    return (
      <div className="bg-white/60 rounded-md px-3 py-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Break-even</p>
        <p className="text-xs text-[#1A1A17]">
          Order of {qty} units at {formatCurrency(unitCost)} each — need to sell{" "}
          <strong>{unitsToBreakEven} units</strong> to recover the cost.
        </p>
        <p className={cn("text-xs font-500", riskColor)}>
          {daysToBreakEven !== null
            ? `At ${avgDaily.toFixed(1)}/day → ${Math.ceil(daysToBreakEven)} days to break even`
            : "Insufficient sales velocity to estimate"}
          {" · "}risk: {risk}
        </p>
      </div>
    );
  }

  if (alert.rule_type === "dead_stock") {
    const sellingPrice = (p?.selling_price ?? 0) as number;
    const unitCost = (p?.unit_cost ?? 0) as number;
    const stock = (p?.stock_on_hand ?? meta.stock_on_hand ?? 0) as number;
    if (!stock || sellingPrice <= 0) return null;

    const be = calcDiscountBreakEven(sellingPrice, unitCost, stock, 50);
    const feasColor = { easy: "text-[#4D7B3D]", moderate: "text-[#B47214]", unrealistic: "text-[#C54632]" }[be.feasibility];
    const marginLabel = be.newMargin < 0 ? `−${formatCurrency(Math.abs(be.newMargin))}` : formatCurrency(be.newMargin);

    return (
      <div className="bg-white/60 rounded-md px-3 py-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Discount break-even</p>
        <p className="text-xs text-[#1A1A17]">
          50% off → new margin {marginLabel}/unit. To match selling {stock} units at full price, you&apos;d need to sell{" "}
          <strong>{be.unitsToMatchCurrentProfit === Infinity ? "∞" : be.unitsToMatchCurrentProfit} units</strong> at the new price.
        </p>
        <p className={cn("text-xs font-500", feasColor)}>
          Feasibility: {be.feasibility}
          {be.newMargin < 0 && " · selling below cost"}
        </p>
      </div>
    );
  }

  if (alert.rule_type === "real_margin") {
    const sellingPrice = (p?.selling_price ?? 0) as number;
    const suggestedPrice = (meta.suggested_price as number | null) ?? alert.suggested_value ?? null;
    const avgMonthly = (meta.avg_daily_sales as number | null) ?? null;
    if (!suggestedPrice || !avgMonthly) return null;

    const unitCost = (meta.cost as number | null) ?? (p?.unit_cost ?? 0) as number;
    const newMargin = suggestedPrice - unitCost;
    const currentMargin = sellingPrice - unitCost;

    return (
      <div className="bg-white/60 rounded-md px-3 py-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Margin impact</p>
        <p className="text-xs text-[#1A1A17]">
          At suggested price {formatCurrency(suggestedPrice)}: margin {formatCurrency(newMargin)}/unit
          {currentMargin > 0 && ` (was ${formatCurrency(currentMargin)}/unit)`}.
          At {avgMonthly.toFixed(1)}/month → {formatCurrency(newMargin * avgMonthly)}/month contribution.
        </p>
      </div>
    );
  }

  return null;
}

// ── Threshold section ─────────────────────────────────────────────────────────

function ThresholdSection({
  alert,
  ruleConfig,
}: {
  alert: AlertWithProduct;
  ruleConfig: Record<string, unknown>;
}) {
  const ruleMeta = RULE_SCHEMAS[alert.rule_type];
  const keys = ACTION_CARD_THRESHOLDS[alert.rule_type];
  if (!ruleMeta || !keys?.length) return null;

  const thresholds = ruleMeta.thresholds.filter((t) => keys.includes(t.key));

  return (
    <div className="bg-white/60 rounded-md px-3 py-2.5 space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Thresholds — edit to re-evaluate</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {thresholds.map((t) => {
          const value = (ruleConfig[t.key] as number | undefined) ?? t.default;
          return (
            <div key={t.key} className="flex items-center gap-1.5">
              <span className="text-xs text-[#6B6B66]">{t.label}:</span>
              <ThresholdEdit
                ruleType={alert.rule_type}
                configKey={t.key}
                value={value}
                format={t.format}
                min={t.min}
                max={t.max}
                step={t.step}
                label={t.label}
                helpText={t.helpText}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PrimaryAction =
  | { mode: "complete"; label: string }
  | { mode: "navigate"; label: string; href: string }
  | { mode: "price-edit"; label: string }
  | { mode: "quick-po"; label: string };

function getPrimaryAction(alert: AlertWithProduct): PrimaryAction {
  switch (alert.rule_type) {
    case "reorder":
      return { mode: "quick-po", label: "Create purchase order" };
    case "dead_stock":
      return { mode: "complete", label: "Apply 50% discount" };
    case "real_margin":
      return { mode: "price-edit", label: "Adjust price" };
    case "customer_churn":
      return { mode: "complete", label: "Mark as called" };
    case "supplier_scorecard":
      return {
        mode: "navigate",
        label: "Open supplier",
        href: `/suppliers/${alert.related_supplier_id ?? (alert.metadata.supplier_id as string) ?? ""}`,
      };
    case "ecommerce_pipeline":
      return { mode: "navigate", label: "Open pipeline", href: `/products?listed_online=false` };
    case "seasonal_preorder":
      return {
        mode: "navigate",
        label: "Plan order",
        href: `/purchases/new?from_alert=${alert.id}&product=${alert.related_product_id ?? ""}`,
      };
    default:
      return { mode: "complete", label: "Mark done" };
  }
}

interface ActionCardProps {
  alert: AlertWithProduct;
  ruleConfig: Record<string, unknown>;
}

type Panel = "none" | "snooze" | "dismiss";

export function ActionCard({ alert, ruleConfig }: ActionCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Snooze state
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [snoozeReason, setSnoozeReason] = useState("");

  // Dismiss state
  const [dismissReason, setDismissReason] = useState("");

  // Price-edit state for real_margin
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState<string>(
    alert.suggested_value != null ? String(alert.suggested_value) : ""
  );

  const severity = severityConfig[alert.severity] ?? severityConfig.yellow;
  const primaryAction = getPrimaryAction(alert);

  async function handlePrimary() {
    if (primaryAction.mode === "navigate") {
      router.push(primaryAction.href);
      return;
    }
    if (primaryAction.mode === "price-edit") {
      setEditingPrice(true);
      setExpanded(true);
      return;
    }
    if (primaryAction.mode === "quick-po") {
      setSheetOpen(true);
      return;
    }
    // mode === "complete"
    setBusy(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/complete`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        toast.success("Alert marked complete");
      } else {
        toast.error("Failed to complete alert");
      }
    } finally {
      setBusy(false);
    }
  }

  async function applyPrice() {
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      if (res.ok) {
        setDone(true);
        toast.success(`Price updated to ${formatCurrency(price)}`);
      } else {
        toast.error("Failed to update price");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSnooze() {
    if (!snoozeReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: snoozeReason, days: snoozeDays }),
      });
      if (res.ok) {
        setDone(true);
        toast.success(`Snoozed for ${snoozeDays} day${snoozeDays !== 1 ? "s" : ""}`);
      } else {
        toast.error("Failed to snooze alert");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    if (!dismissReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: dismissReason }),
      });
      if (res.ok) {
        setDone(true);
        toast.success("Alert dismissed");
      } else {
        toast.error("Failed to dismiss alert");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <>
    {primaryAction.mode === "quick-po" && (
      <QuickPoSheet alert={alert} open={sheetOpen} onOpenChange={setSheetOpen} />
    )}
    <div className={cn("rounded-lg border overflow-hidden", severity.bg, severity.border)}>
      {/* Header row */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", severity.dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-500 text-[#1A1A17] leading-snug">{alert.title}</p>
              <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">{alert.summary}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3 bg-white border-[#E5E5E2] hover:bg-[#F7F7F5] text-[#1A1A17]"
                onClick={handlePrimary}
                disabled={busy}
              >
                {busy ? <span className="animate-pulse">...</span> : primaryAction.label}
              </Button>

              {ACTION_CARD_THRESHOLDS[alert.rule_type]?.length > 0 && (
                <button
                  onClick={() => { setShowThresholds(!showThresholds); setExpanded(true); }}
                  title="Edit thresholds"
                  className={cn(
                    "p-1 rounded transition-colors",
                    showThresholds
                      ? "text-[#1A1A17] bg-black/5"
                      : "text-[#C8C8C4] hover:text-[#6B6B66] hover:bg-black/5"
                  )}
                >
                  <Settings2 size={13} />
                </button>
              )}

              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded hover:bg-black/5 text-[#6B6B66] transition-colors"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-black/5 pt-3 space-y-4">
          {/* Detail grid */}
          <DetailGrid alert={alert} />

          {/* Break-even analysis */}
          <BreakEvenBlock alert={alert} />

          {/* Econometrics block for statistical rules */}
          <EconometricsBlock alert={alert} />

          {/* Inline threshold editor */}
          {showThresholds && (
            <ThresholdSection alert={alert} ruleConfig={ruleConfig} />
          )}

          {/* Inline price editor for real_margin */}
          {editingPrice && (
            <div className="bg-white/60 rounded-md px-3 py-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">
                New selling price
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B6B66]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="flex-1 text-sm border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] tabular-nums"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && applyPrice()}
                />
                <Button size="sm" className="bg-[#1A1A17] text-white h-8 px-3 text-xs" onClick={applyPrice} disabled={busy}>
                  {busy ? "..." : "Apply"}
                </Button>
                <button onClick={() => setEditingPrice(false)} className="text-xs text-[#6B6B66] hover:text-[#1A1A17]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Decision trail / Why reasoning */}
          <ReasoningTrail alert={alert} />

          {/* Action row */}
          {!editingPrice && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPanel(panel === "snooze" ? "none" : "snooze")}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    panel === "snooze" ? "text-[#1A1A17]" : "text-[#6B6B66] hover:text-[#1A1A17]"
                  )}
                >
                  <Clock size={11} />
                  Snooze
                </button>

                <button
                  onClick={() => setPanel(panel === "dismiss" ? "none" : "dismiss")}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    panel === "dismiss" ? "text-[#C54632]" : "text-[#6B6B66] hover:text-[#C54632]"
                  )}
                >
                  <X size={11} />
                  Dismiss
                </button>
              </div>

              <Button
                size="sm"
                className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-8 px-4 text-xs"
                onClick={handlePrimary}
                disabled={busy}
              >
                {busy ? "..." : primaryAction.label}
              </Button>
            </div>
          )}

          {/* Snooze panel */}
          {panel === "snooze" && (
            <div className="space-y-2 p-3 bg-white/60 rounded-md">
              <div className="flex gap-1.5 flex-wrap">
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setSnoozeDays(opt.days)}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded border transition-colors",
                      snoozeDays === opt.days
                        ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                        : "bg-white border-[#E5E5E2] text-[#6B6B66] hover:border-[#1A1A17] hover:text-[#1A1A17]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 text-xs border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
                  placeholder="Why? (helps train future rules)"
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSnooze()}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3 shrink-0"
                  onClick={handleSnooze}
                  disabled={busy || !snoozeReason.trim()}
                >
                  {busy ? "..." : "Snooze"}
                </Button>
              </div>
            </div>
          )}

          {/* Dismiss panel */}
          {panel === "dismiss" && (
            <div className="space-y-2 p-3 bg-[#FDF2F0] rounded-md border border-[#C54632]/20">
              <p className="text-[11px] text-[#C54632] font-500">Dismiss this alert — it won&apos;t reappear until the engine next runs.</p>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 text-xs border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#C54632]"
                  placeholder="Reason (required)"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDismiss()}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-3 shrink-0 border-[#C54632] text-[#C54632] hover:bg-[#FDF2F0]"
                  onClick={handleDismiss}
                  disabled={busy || !dismissReason.trim()}
                >
                  {busy ? "..." : "Dismiss"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function DetailCell({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="bg-white/60 rounded px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">{label}</p>
      <p className="text-sm font-500 text-[#1A1A17] tabular-nums">{value}</p>
    </div>
  );
}

function DetailGrid({ alert }: { alert: AlertWithProduct }) {
  const meta = alert.metadata;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (Array.isArray(alert.products) ? (alert.products as any[])[0] : alert.products) as {
    stock_on_hand?: number; unit_cost?: number; selling_price?: number;
  } | null | undefined;

  switch (alert.rule_type) {
    case "dead_stock":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="Stock" value={`${p?.stock_on_hand ?? "—"} units`} />
          <DetailCell label="Cash tied up" value={meta.cash_tied_up != null ? formatCurrency(meta.cash_tied_up as number) : "—"} />
          <DetailCell label="Days idle" value={meta.days_since_last_sale != null ? `${meta.days_since_last_sale}d` : "—"} />
          <DetailCell label="Cost price" value={p?.unit_cost != null ? formatCurrency(p.unit_cost) : "—"} />
          <DetailCell label="Sell price" value={p?.selling_price != null ? formatCurrency(p.selling_price) : "—"} />
          <DetailCell label="50% off price" value={meta.discounted_price != null ? formatCurrency(meta.discounted_price as number) : "—"} />
        </div>
      );

    case "reorder":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="Stock on hand" value={`${p?.stock_on_hand ?? meta.stock_on_hand ?? "—"} units`} />
          <DetailCell label="Days of cover" value={meta.days_of_cover != null ? `${Math.floor(meta.days_of_cover as number)}d` : "—"} />
          <DetailCell label="Avg daily" value={meta.avg_daily != null ? `${(meta.avg_daily as number).toFixed(1)}/d` : "—"} />
          <DetailCell label="Reorder point" value={meta.reorder_point != null ? `${Math.ceil(meta.reorder_point as number)} units` : "—"} />
          <DetailCell label="Order qty" value={alert.suggested_qty != null ? `${alert.suggested_qty} units` : "—"} />
          <DetailCell label="Lead time" value={meta.lead_time != null ? `${meta.lead_time}d` : "—"} />
          {!!meta.supplier_name && <DetailCell label="Supplier" value={meta.supplier_name as string} />}
          {meta.moq != null && (meta.moq as number) > 1 && <DetailCell label="Min order" value={`${meta.moq as number} units`} />}
          {!!meta.abc_class && <DetailCell label="Class" value={meta.abc_class as string} />}
        </div>
      );

    case "real_margin":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="Unit cost" value={meta.cost != null ? formatCurrency(meta.cost as number) : (p?.unit_cost != null ? formatCurrency(p.unit_cost) : "—")} />
          <DetailCell label="Sell price" value={p?.selling_price != null ? formatCurrency(p.selling_price) : "—"} />
          <DetailCell label="Margin" value={meta.real_margin_pct != null ? formatPercent(meta.real_margin_pct as number) : "—"} />
          <DetailCell label="Target margin" value={meta.target_margin != null ? formatPercent(meta.target_margin as number) : "—"} />
          <DetailCell label="Suggested price" value={meta.suggested_price != null ? formatCurrency(meta.suggested_price as number) : (alert.suggested_value != null ? formatCurrency(alert.suggested_value) : "—")} />
          {meta.platform_fee != null && <DetailCell label="Platform fee" value={formatCurrency(meta.platform_fee as number)} />}
        </div>
      );

    case "customer_churn":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="Last order" value={meta.last_order_at ? new Date(meta.last_order_at as string).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
          <DetailCell label="Days overdue" value={meta.days_since_last_order != null ? `${meta.days_since_last_order}d` : "—"} />
          <DetailCell label="Avg interval" value={meta.avg_order_interval_days != null ? `${Math.round(meta.avg_order_interval_days as number)}d` : "—"} />
          <DetailCell label="Total orders" value={meta.total_orders != null ? String(meta.total_orders) : "—"} />
          <DetailCell label="Total spent" value={meta.total_spent != null ? formatCurrency(meta.total_spent as number) : "—"} />
          <DetailCell label="Threshold" value={meta.threshold_days != null ? `${meta.threshold_days}d` : "—"} />
        </div>
      );

    case "supplier_scorecard":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="On-time rate" value={meta.on_time_rate != null ? formatPercent(meta.on_time_rate as number, 0) : "—"} />
          <DetailCell label="Fill rate" value={meta.fill_rate != null ? formatPercent(meta.fill_rate as number, 0) : "—"} />
          <DetailCell label="Lead time" value={meta.avg_lead_time_real != null ? `${meta.avg_lead_time_real}d actual` : "—"} />
          <DetailCell label="Promised" value={meta.promised_lead_time != null ? `${meta.promised_lead_time}d` : "—"} />
          <DetailCell label="Orders (12mo)" value={meta.total_orders != null ? String(meta.total_orders) : "—"} />
          {meta.total_spend != null && (meta.total_spend as number) > 0 && (
            <DetailCell label="Total spend" value={formatCurrency(meta.total_spend as number)} />
          )}
        </div>
      );

    case "ecommerce_pipeline": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skus = (meta.skus as any[]) ?? [];
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <DetailCell label="Candidates" value={`${meta.count ?? skus.length} SKUs`} />
            <DetailCell label="Avg margin" value={meta.avg_margin != null ? formatPercent(meta.avg_margin as number) : "—"} />
            <DetailCell label="Avg cover" value={meta.avg_cover != null ? `${meta.avg_cover}d` : "—"} />
          </div>
          {skus.length > 0 && (
            <div className="bg-white/60 rounded-md px-3 py-2 space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] mb-1.5">Top candidates</p>
              {skus.slice(0, 5).map((s: { sku: string; name: string; margin: number }) => (
                <div key={s.sku} className="flex items-center gap-3 text-xs">
                  <span className="font-500 text-[#1A1A17] w-20 shrink-0">{s.sku}</span>
                  <span className="text-[#6B6B66] flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums text-[#4D7B3D] shrink-0">{formatPercent(s.margin)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "seasonal_preorder":
      return (
        <div className="grid grid-cols-3 gap-2">
          <DetailCell label="Days until" value={meta.days_until_start != null ? `${meta.days_until_start}d` : "—"} />
          <DetailCell label="Stock on hand" value={meta.stock_on_hand != null ? `${meta.stock_on_hand} units` : "—"} />
          <DetailCell label="Expected demand" value={meta.expected_demand != null ? `${meta.expected_demand} units` : "—"} />
          <DetailCell label="Last year" value={meta.last_year_sales != null ? `${meta.last_year_sales} sold` : "—"} />
          <DetailCell label="Order qty" value={alert.suggested_qty != null ? `${alert.suggested_qty} units` : "—"} />
          <DetailCell label="Lead time" value={meta.lead_time_days != null ? `${meta.lead_time_days}d` : "—"} />
          {!!meta.supplier_name && <DetailCell label="Supplier" value={meta.supplier_name as string} />}
        </div>
      );

    default:
      return null;
  }
}

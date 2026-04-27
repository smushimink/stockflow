"use client";

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AlertWithProduct } from "@/lib/decisions/types";

const severityConfig = {
  red: {
    dot: "bg-[#C54632]",
    bg: "bg-[#FDF2F0]",
    border: "border-[#C54632]/20",
    label: "Urgent",
    textColor: "text-[#C54632]",
  },
  orange: {
    dot: "bg-[#B47214]",
    bg: "bg-[#FDF8EE]",
    border: "border-[#B47214]/20",
    label: "This week",
    textColor: "text-[#B47214]",
  },
  yellow: {
    dot: "bg-[#B47214]",
    bg: "bg-white",
    border: "border-[#E5E5E2]",
    label: "Monitor",
    textColor: "text-[#B47214]",
  },
  green: {
    dot: "bg-[#4D7B3D]",
    bg: "bg-[#F2F8F0]",
    border: "border-[#4D7B3D]/20",
    label: "Healthy",
    textColor: "text-[#4D7B3D]",
  },
};

interface ActionCardProps {
  alert: AlertWithProduct;
  onComplete?: (alertId: string) => void;
  onSnooze?: (alertId: string, reason: string) => void;
}

export function ActionCard({ alert, onComplete, onSnooze }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState("");
  const [done, setDone] = useState(false);

  const severity = severityConfig[alert.severity];
  const meta = alert.metadata as Record<string, unknown>;

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/complete`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        onComplete?.(alert.id);
      }
    } finally {
      setCompleting(false);
    }
  }

  async function handleSnooze() {
    if (!snoozeReason.trim()) return;
    setSnoozing(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: snoozeReason }),
      });
      if (res.ok) {
        setDone(true);
        onSnooze?.(alert.id, snoozeReason);
      }
    } finally {
      setSnoozing(false);
    }
  }

  if (done) return null;

  const primaryAction = getPrimaryAction(alert);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-all",
        severity.bg,
        severity.border
      )}
    >
      {/* Collapsed header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", severity.dot)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-500 text-[#1A1A17] leading-snug">{alert.title}</p>
              <p className="text-xs text-[#6B6B66] mt-0.5 leading-relaxed">{alert.summary}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Primary action */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3 bg-white border-[#E5E5E2] hover:bg-[#F7F7F5] text-[#1A1A17]"
                onClick={handleComplete}
                disabled={completing}
              >
                {completing ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <><Check size={10} className="mr-1" />{primaryAction}</>
                )}
              </Button>

              {/* Expand/collapse */}
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

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-black/5 pt-3">

          {/* Detail grid */}
          {alert.products && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = (Array.isArray(alert.products) ? (alert.products as any[])[0] : alert.products) as {
              stock_on_hand: number; unit_cost: number; selling_price: number;
            } | null;
            if (!p) return null;
            return (
              <div className="grid grid-cols-3 gap-3">
                <DetailCell label="Stock" value={`${p.stock_on_hand} units`} />
                <DetailCell label="Cash tied up" value={formatCurrency(meta.cash_tied_up as number)} />
                <DetailCell label="Days idle" value={`${meta.days_since_last_sale}d`} />
                <DetailCell label="Cost price" value={formatCurrency(p.unit_cost)} />
                <DetailCell label="Sell price" value={formatCurrency(p.selling_price)} />
                <DetailCell label="At 50% off" value={formatCurrency(meta.discounted_price as number)} />
              </div>
            );
          })()}

          {/* Why reasoning */}
          {alert.reasoning && (
            <div className="bg-white/60 rounded-md px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] mb-1">Why this alert</p>
              <p className="text-xs text-[#1A1A17] leading-relaxed">{alert.reasoning}</p>
            </div>
          )}

          {/* Suggested action */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] mb-0.5">Suggested action</p>
              <p className="text-sm font-500 text-[#1A1A17]">{alert.suggested_action}</p>
              {alert.suggested_value && (
                <p className="text-xs text-[#6B6B66]">New price: {formatCurrency(alert.suggested_value)}</p>
              )}
            </div>

            <Button
              size="sm"
              className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-8 px-4 text-xs"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? "Applying..." : "Apply 50% discount"}
            </Button>
          </div>

          {/* Snooze */}
          {!snoozing ? (
            <button
              onClick={() => setSnoozing(true)}
              className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
            >
              <Clock size={11} />
              Snooze this alert
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="flex-1 text-xs border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
                placeholder="Why are you snoozing? (trains future rules)"
                value={snoozeReason}
                onChange={(e) => setSnoozeReason(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSnooze()}
                autoFocus
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3"
                onClick={handleSnooze}
                disabled={!snoozeReason.trim()}
              >
                Snooze
              </Button>
              <button
                onClick={() => setSnoozing(false)}
                className="text-xs text-[#6B6B66] hover:text-[#1A1A17]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/60 rounded px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">{label}</p>
      <p className="text-sm font-500 text-[#1A1A17] tabular-nums">{value}</p>
    </div>
  );
}

function getPrimaryAction(alert: AlertWithProduct): string {
  switch (alert.rule_type) {
    case "dead_stock": return "Apply 50% discount";
    case "reorder": return "Create order";
    case "real_margin": return "Adjust price";
    case "customer_churn": return "Mark as called";
    default: return "Mark done";
  }
}

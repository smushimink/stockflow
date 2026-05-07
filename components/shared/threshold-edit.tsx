"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateThreshold } from "@/app/(dashboard)/rules/actions";
import type { ThresholdFormat } from "@/lib/decisions/rule-schemas";

interface ThresholdEditProps {
  ruleType: string;
  configKey: string;
  value: number;
  format: ThresholdFormat;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  helpText?: string;
  className?: string;
  onSaved?: (newValue: number, total: number) => void;
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function formatThreshold(value: number, format: ThresholdFormat): string {
  switch (format) {
    case "multiplier": return `${value.toFixed(1)}×`;
    case "days":       return `${Math.round(value)}d`;
    case "percent":    return `${Math.round(value * 100)}%`;
    case "currency":   return `$${Math.round(value).toLocaleString("en-AU")}`;
    case "units":      return `${Math.round(value)}`;
  }
}

// Convert display value → stored value
function toStored(display: number, format: ThresholdFormat): number {
  return format === "percent" ? display / 100 : display;
}

// Convert stored value → display value (what user sees in input)
function toDisplay(stored: number, format: ThresholdFormat): number {
  return format === "percent" ? stored * 100 : stored;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThresholdEdit({
  ruleType,
  configKey,
  value,
  format,
  min,
  max,
  step = 1,
  label,
  helpText,
  className,
  onSaved,
}: ThresholdEditProps) {
  const [editing, setEditing] = useState(false);
  const [displayInput, setDisplayInput] = useState("");
  const [currentValue, setCurrentValue] = useState(value);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if external value changes
  useEffect(() => { setCurrentValue(value); }, [value]);

  function startEdit() {
    setDisplayInput(String(toDisplay(currentValue, format)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function cancel() {
    setEditing(false);
    setDisplayInput("");
  }

  function commit() {
    const raw = parseFloat(displayInput);
    if (isNaN(raw)) { cancel(); return; }

    // Clamp to min/max in display space
    const dispMin = min !== undefined ? toDisplay(min, format) : -Infinity;
    const dispMax = max !== undefined ? toDisplay(max, format) : Infinity;
    const clamped = Math.max(dispMin, Math.min(dispMax, raw));

    const stored = toStored(clamped, format);
    if (stored === currentValue) { cancel(); return; }

    setEditing(false);
    const prevValue = currentValue;
    setCurrentValue(stored);

    startTransition(async () => {
      const result = await updateThreshold(ruleType, configKey, stored);
      if (result.error) {
        toast.error(`Failed to save: ${result.error}`);
        setCurrentValue(prevValue);
      } else {
        const delta = (result.newAlerts ?? 0) - (result.total ?? 0);
        const alertMsg =
          result.total !== undefined
            ? `${result.total} alert${result.total !== 1 ? "s" : ""} active${result.newAlerts ? ` · ${result.newAlerts} new` : ""}`
            : "Rule re-evaluated";
        toast.success(`${label ?? configKey} → ${formatThreshold(stored, format)}. ${alertMsg}.`);
        onSaved?.(stored, result.total ?? 0);
        void delta; // suppress unused warning
      }
    });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  }

  const displayStep = format === "percent" ? (step ? step * 100 : 1) : step;
  const displayMin  = min !== undefined ? toDisplay(min, format) : undefined;
  const displayMax  = max !== undefined ? toDisplay(max, format) : undefined;

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <input
          ref={inputRef}
          type="number"
          value={displayInput}
          onChange={(e) => setDisplayInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          min={displayMin}
          max={displayMax}
          step={displayStep}
          autoFocus
          className="w-20 text-sm tabular-nums border-2 border-[#1A1A17] rounded px-2 py-0.5 bg-white focus:outline-none text-[#1A1A17]"
        />
        {format === "percent" && <span className="text-xs text-[#6B6B66]">%</span>}
        {format === "multiplier" && <span className="text-xs text-[#6B6B66]">×</span>}
        {format === "days" && <span className="text-xs text-[#6B6B66]">d</span>}
      </span>
    );
  }

  return (
    <button
      onClick={startEdit}
      disabled={isPending}
      title={helpText}
      className={cn(
        "inline-flex items-center gap-0.5 group rounded px-1 py-0.5 transition-colors",
        "hover:bg-[#F0F0EE] focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20",
        isPending ? "opacity-50 cursor-wait" : "cursor-pointer",
        className
      )}
    >
      <span className="text-sm font-600 tabular-nums text-[#1A1A17] group-hover:text-[#1A1A17]">
        {isPending ? "…" : formatThreshold(currentValue, format)}
      </span>
      <span className="text-[10px] text-[#C8C8C4] group-hover:text-[#6B6B66] transition-colors ml-0.5 select-none">✎</span>
    </button>
  );
}

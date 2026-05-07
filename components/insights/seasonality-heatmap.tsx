"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  runSeasonalityDetection,
  setPatternConfirmed,
} from "@/app/(dashboard)/insights/seasonality/actions";
import type { MonthIndex } from "@/lib/analytics/seasonality";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HeatmapRow {
  patternId: string;
  productId: string;
  productName: string;
  sku: string;
  monthlyIndices: number[];   // 12 values, index 0 = Jan
  confidence: number;
  manuallyConfirmed: boolean;
}

export interface InsufficientDataState {
  dataMonths: number;
  minRequired: 12;
  message: string;
}

interface Props {
  rows: HeatmapRow[];
  insufficientData?: InsufficientDataState | null;
  lastDetectedAt?: string | null;
}

// ── Colour mapping ────────────────────────────────────────────────────────────

function indexToBg(index: number): string {
  if (index === 0) return "bg-[#F0F0EE]"; // no data
  if (index >= 2.0) return "bg-[#1D4ED8]";
  if (index >= 1.6) return "bg-[#3B82F6]";
  if (index >= 1.4) return "bg-[#93C5FD]";
  if (index >= 1.15) return "bg-[#BFDBFE]";
  if (index > 0.85) return "bg-white";
  if (index > 0.6)  return "bg-[#FECACA]";
  if (index > 0.3)  return "bg-[#F87171]";
  return "bg-[#DC2626]";
}

function indexToTextColor(index: number): string {
  if (index >= 1.6 || index <= 0.3) return "text-white";
  return "text-[#1A1A17]";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Drilldown cell ────────────────────────────────────────────────────────────

interface DrilldownState {
  row: HeatmapRow;
  monthIdx: number; // 0-based
}

function Drilldown({ state, onClose }: { state: DrilldownState; onClose: () => void }) {
  const { row, monthIdx } = state;
  const index = row.monthlyIndices[monthIdx] ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">{MONTHS[monthIdx]}</p>
            <p className="text-base font-600 text-[#1A1A17] mt-0.5">{row.productName}</p>
            <p className="text-xs text-[#6B6B66]">{row.sku}</p>
          </div>
          <button onClick={onClose} className="text-[#6B6B66] hover:text-[#1A1A17] text-lg leading-none">×</button>
        </div>

        <div className="rounded-lg border border-[#E5E5E2] p-3 space-y-1">
          <p className="text-xs text-[#6B6B66]">Seasonal index</p>
          <p className="text-2xl font-600 text-[#1A1A17]">{index.toFixed(2)}×</p>
          <p className="text-xs text-[#6B6B66]">
            {index > 1
              ? `Sales are typically ${((index - 1) * 100).toFixed(0)}% above average in ${MONTHS[monthIdx]}`
              : index < 1
              ? `Sales are typically ${((1 - index) * 100).toFixed(0)}% below average in ${MONTHS[monthIdx]}`
              : `Sales are at average in ${MONTHS[monthIdx]}`}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-[#6B6B66]">Full year shape</p>
          <div className="flex gap-px items-end h-10">
            {row.monthlyIndices.map((v, i) => (
              <div
                key={i}
                title={`${MONTHS[i]}: ${v.toFixed(2)}×`}
                className={cn(
                  "flex-1 rounded-sm transition-all",
                  i === monthIdx ? "ring-2 ring-[#1A1A17]" : "",
                  indexToBg(v)
                )}
                style={{ height: `${Math.max(4, Math.min(100, v * 30))}%` }}
              />
            ))}
          </div>
          <div className="flex gap-px justify-between">
            {MONTHS.map((m, i) => (
              <span key={i} className={cn("text-[8px] flex-1 text-center", i === monthIdx ? "font-700 text-[#1A1A17]" : "text-[#C8C8C4]")}>
                {m[0]}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-[#6B6B66]">
          Detection confidence: {Math.round(row.confidence * 100)}%
          {row.manuallyConfirmed ? " · manually confirmed" : ""}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SeasonalityHeatmap({ rows, insufficientData, lastDetectedAt }: Props) {
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDetect() {
    startTransition(async () => {
      const result = await runSeasonalityDetection();
      if ("error" in result) {
        toast.error(result.error);
      } else if (result.status === "insufficient_data") {
        toast.info(result.message ?? "Insufficient data for detection");
      } else {
        toast.success(
          result.patternsDetected > 0
            ? `Detected patterns for ${result.patternsDetected} product${result.patternsDetected !== 1 ? "s" : ""}`
            : "Detection complete — no significant patterns found yet"
        );
      }
    });
  }

  function handleConfirm(patternId: string, confirmed: boolean) {
    startTransition(async () => {
      const result = await setPatternConfirmed(patternId, confirmed);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(confirmed ? "Pattern confirmed" : "Confirmation removed");
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          {lastDetectedAt ? (
            <p className="text-xs text-[#6B6B66]">
              Last detected: {new Date(lastDetectedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : (
            <p className="text-xs text-[#6B6B66]">No detection run yet</p>
          )}
        </div>
        <button
          onClick={handleDetect}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A1A17] text-white text-sm font-500 hover:bg-[#2D2D29] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Detecting…" : "Detect patterns"}
        </button>
      </div>

      {/* Insufficient data notice */}
      {insufficientData && (
        <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-6 space-y-3">
          <p className="text-sm font-500 text-[#1A1A17]">Insufficient history for seasonality detection</p>
          <p className="text-sm text-[#6B6B66]">{insufficientData.message}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#6B6B66]">
              <span>{insufficientData.dataMonths} month{insufficientData.dataMonths !== 1 ? "s" : ""} available</span>
              <span>{insufficientData.minRequired} months required</span>
            </div>
            <div className="h-2 rounded-full bg-[#E5E5E2] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4D7B3D] transition-all"
                style={{ width: `${Math.min(100, (insufficientData.dataMonths / insufficientData.minRequired) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-[#6B6B66]">
            Patterns will be detected automatically. The seasonal forecast rule will use hardcoded season dates until then.
          </p>
        </div>
      )}

      {/* No patterns but detection has been run */}
      {!insufficientData && rows.length === 0 && (
        <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-6 text-center space-y-2">
          <p className="text-sm font-500 text-[#1A1A17]">No patterns detected</p>
          <p className="text-sm text-[#6B6B66]">
            No significant seasonal variation was found. Products with consistent year-round sales won't show patterns.
          </p>
        </div>
      )}

      {/* Heatmap */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            Seasonal index heatmap — {rows.length} product{rows.length !== 1 ? "s" : ""}
          </p>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-[#6B6B66]">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-[#1D4ED8]" />
              <span>Peak (×2+)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-[#93C5FD]" />
              <span>Elevated</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block border border-[#E5E5E2] bg-white" />
              <span>Average</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block bg-[#F87171]" />
              <span>Trough</span>
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto rounded-xl border border-[#E5E5E2]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2.5 font-500 text-[#6B6B66] w-48 min-w-[12rem] sticky left-0 bg-white z-10">
                    Product
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="px-1 py-2.5 font-500 text-[#6B6B66] text-center w-12">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-500 text-[#6B6B66] text-right">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.patternId} className="border-b border-[#E5E5E2] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2 sticky left-0 bg-white z-10">
                      <p className="font-500 text-[#1A1A17] truncate max-w-[11rem]" title={row.productName}>
                        {row.productName}
                      </p>
                      <p className="text-[10px] text-[#6B6B66]">{row.sku}</p>
                    </td>
                    {row.monthlyIndices.map((index, mIdx) => (
                      <td
                        key={mIdx}
                        className="p-px cursor-pointer"
                        onClick={() => setDrilldown({ row, monthIdx: mIdx })}
                      >
                        <div
                          className={cn(
                            "h-9 w-11 flex items-center justify-center rounded-md text-[10px] font-500 transition-transform hover:scale-110",
                            indexToBg(index),
                            indexToTextColor(index)
                          )}
                        >
                          {index > 0 ? index.toFixed(1) : "—"}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-[#6B6B66]">
                      {Math.round(row.confidence * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patterns list with confirm/reject */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Pattern review</p>
          <div className="space-y-2">
            {rows.map((row) => {
              const peaks = row.monthlyIndices
                .map((v, i) => ({ month: i, v }))
                .filter((x) => x.v >= 1.4);

              return (
                <div
                  key={row.patternId}
                  className="flex items-center justify-between rounded-xl border border-[#E5E5E2] bg-white px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-500 text-[#1A1A17]">{row.productName}</p>
                      {row.manuallyConfirmed && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-600 bg-[#F2F8F0] text-[#4D7B3D]">
                          Confirmed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B6B66]">
                      {peaks.length > 0
                        ? `Peaks in ${peaks.map((p) => MONTHS[p.month]).join(", ")} · confidence ${Math.round(row.confidence * 100)}%`
                        : `No significant peaks · confidence ${Math.round(row.confidence * 100)}%`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!row.manuallyConfirmed ? (
                      <button
                        onClick={() => handleConfirm(row.patternId, true)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-500 bg-[#F2F8F0] text-[#4D7B3D] hover:bg-[#E5F2E0] disabled:opacity-50 transition-colors"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirm(row.patternId, false)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-500 bg-[#F7F7F5] text-[#6B6B66] hover:bg-[#F0F0EE] disabled:opacity-50 transition-colors"
                      >
                        Unconfirm
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cell drilldown overlay */}
      {drilldown && <Drilldown state={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  );
}

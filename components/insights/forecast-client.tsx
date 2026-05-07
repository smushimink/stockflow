"use client";

import { useState, useTransition } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, HelpCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ForecastRow } from "@/app/(dashboard)/insights/forecast/page";

// ── Colour tokens ─────────────────────────────────────────────────────────────
const PATTERN_META: Record<string, { label: string; color: string; bg: string; strategy: string }> = {
  smooth:       { label: "Smooth",       color: "#4D7B3D", bg: "#F2F8F0", strategy: "Auto-reorder confidently" },
  erratic:      { label: "Erratic",      color: "#B47214", bg: "#FDF6EC", strategy: "Auto-reorder with wider buffer" },
  intermittent: { label: "Intermittent", color: "#6B5FAD", bg: "#F3F0FA", strategy: "Slower reorder cadence" },
  lumpy:        { label: "Lumpy",        color: "#C54632", bg: "#FDF0EE", strategy: "Manual review needed" },
  sparse:       { label: "Sparse",       color: "#9A9A93", bg: "#F7F7F5", strategy: "Insufficient data" },
};

function patternMeta(p: string | null) {
  return PATTERN_META[p ?? ""] ?? { label: p ?? "—", color: "#9A9A93", bg: "#F7F7F5", strategy: "" };
}

// ── Confidence chip ───────────────────────────────────────────────────────────
function ConfidenceChip({ q }: { q: number | null }) {
  if (q === null) return <span className="text-[11px] text-[#9A9A93]">—</span>;
  const level = q >= 0.7 ? "high" : q >= 0.4 ? "medium" : "low";
  const conf = {
    high:   { dot: "bg-[#4D7B3D]", label: "High confidence" },
    medium: { dot: "bg-[#B47214]", label: "Medium confidence" },
    low:    { dot: "bg-[#C54632]", label: "Low confidence" },
  }[level];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
      <span className="text-[11px] text-[#5C5C57]">{conf.label}</span>
    </span>
  );
}

// ── Pattern bar ───────────────────────────────────────────────────────────────
function PatternBar({ counts, total, onFilter }: {
  counts: Record<string, number>;
  total: number;
  onFilter: (p: string | null) => void;
}) {
  const order = ["smooth", "erratic", "intermittent", "lumpy", "sparse"];
  return (
    <div className="space-y-2.5">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {order.map((p) => {
          const pct = total > 0 ? ((counts[p] ?? 0) / total) * 100 : 0;
          const meta = patternMeta(p);
          return pct > 0 ? (
            <div
              key={p}
              title={`${meta.label}: ${counts[p]} SKUs (${pct.toFixed(0)}%)`}
              onClick={() => onFilter(p)}
              style={{ width: `${pct}%`, background: meta.color }}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
          ) : null;
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {order.map((p) => {
          const meta = patternMeta(p);
          const count = counts[p] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={p}
              onClick={() => onFilter(p)}
              className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
              <span style={{ color: meta.color }} className="font-500">{meta.label}</span>
              <span className="text-[#9A9A93]">{count}</span>
              <span className="text-[#C8C8C4]">·</span>
              <span className="text-[#9A9A93]">{meta.strategy}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── SKU detail panel ──────────────────────────────────────────────────────────
function SkuDetailPanel({ row, onClose }: { row: ForecastRow; onClose: () => void }) {
  const [showMath, setShowMath] = useState(false);
  const meta = patternMeta(row.demand_pattern);

  const detRopDiff =
    row.recommended_rop !== null && row.det_rop !== null
      ? row.recommended_rop - row.det_rop
      : null;

  return (
    <div className="border border-[#E5E5E2] rounded-xl bg-white p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-600 text-[#9A9A93] uppercase tracking-widest">{row.sku}</span>
          <h3 className="text-[15px] font-600 text-[#1A1A17] mt-0.5">{row.name}</h3>
        </div>
        <button onClick={onClose} className="text-[#9A9A93] hover:text-[#1A1A17] text-lg leading-none">×</button>
      </div>

      {/* Why these numbers */}
      <div className="p-4 rounded-lg" style={{ background: meta.bg }}>
        <p className="text-xs font-600 uppercase tracking-widest mb-2" style={{ color: meta.color }}>
          Why these numbers
        </p>
        <p className="text-[13px] text-[#1A1A17] leading-relaxed">
          {row.data_points != null && row.data_points > 0
            ? `For ${row.name}, we analysed ${row.data_points} days of sales history${row.censored_days ? ` across ${row.censored_days} stockout event${row.censored_days !== 1 ? "s" : ""}` : ""}.`
            : "Insufficient sales history for this SKU."}{" "}
          {row.demand_pattern && row.lambda != null &&
            `The demand pattern is "${row.demand_pattern}" — averaging ${row.lambda.toFixed(1)} units/day.`
          }
          {row.ltd_mean != null && row.ltd_p95 != null && row.lead_time_days_used != null &&
            ` Over a ${row.lead_time_days_used}-day lead time, expected demand is ${row.ltd_mean.toFixed(0)} units (95th percentile: ${row.ltd_p95.toFixed(0)}).`
          }
          {row.recommended_rop != null &&
            ` To stay in stock 95% of the time, reorder when you reach ${row.recommended_rop.toFixed(0)} units.`
          }
        </p>
        {row.censored_days != null && row.censored_days > 0 && (
          <p className="text-[12px] mt-2" style={{ color: meta.color }}>
            ✓ {row.censored_days} stockout day{row.censored_days !== 1 ? "s" : ""} corrected — we don&apos;t treat zero sales during stockouts as zero demand.
          </p>
        )}
      </div>

      {/* Key numbers grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Daily demand (λ)", value: row.lambda != null ? `${row.lambda.toFixed(2)}/d` : "—" },
          { label: "LTD 95th pct", value: row.ltd_p95 != null ? `${row.ltd_p95.toFixed(0)} u` : "—" },
          { label: "Recommended ROP", value: row.recommended_rop != null ? `${row.recommended_rop.toFixed(0)} u` : "—" },
          { label: "Target stock", value: row.recommended_target_stock != null ? `${row.recommended_target_stock.toFixed(0)} u` : "—" },
          { label: "Suggested order", value: row.recommended_order_qty != null && row.recommended_order_qty > 0 ? `${row.recommended_order_qty.toFixed(0)} u` : "OK" },
          { label: "vs simple formula", value: detRopDiff != null ? `${detRopDiff > 0 ? "+" : ""}${detRopDiff.toFixed(0)} u` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-lg bg-[#F7F7F5]">
            <p className="text-[10px] text-[#9A9A93] uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-[15px] font-600 text-[#1A1A17]">{value}</p>
          </div>
        ))}
      </div>

      {/* Math toggle */}
      <button
        onClick={() => setShowMath((v) => !v)}
        className="text-xs text-[#6B6B66] underline underline-offset-2 hover:text-[#1A1A17]"
      >
        {showMath ? "Hide" : "Show"} the math →
      </button>

      {showMath && (
        <div className="p-3 rounded-lg bg-[#F7F7F5] font-mono text-[11px] text-[#5C5C57] space-y-1">
          <p>Demand model: Negative Binomial(λ={row.lambda?.toFixed(3) ?? "—"}, k={row.k?.toFixed(3) ?? "—"})</p>
          <p>EWMA smoothing: α=0.3 (weights last 30 days heavily)</p>
          {row.ltd_mean != null && row.ltd_stddev != null &&
            <p>Lead-time demand: NB convolution, μ={row.ltd_mean.toFixed(1)}, σ={row.ltd_stddev.toFixed(1)}</p>}
          {row.recommended_rop != null &&
            <p>ROP: 95th percentile of LTD = {row.recommended_rop.toFixed(0)}</p>}
          {row.critical_ratio != null &&
            <p>Newsvendor critical ratio: {(row.critical_ratio * 100).toFixed(1)}%</p>}
          {row.censored_days != null && row.censored_days > 0 &&
            <p>Censoring correction: {row.censored_days} stockout days adjusted (right-censored)</p>}
          <p>Fit quality: {row.fit_quality != null ? (row.fit_quality * 100).toFixed(0) + "%" : "—"} ({row.data_points ?? 0} data points)</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  rows: ForecastRow[];
  totalProducts: number;
  lastRun: string | null;
}

export function ForecastClient({ rows, totalProducts, lastRun }: Props) {
  const [filterPattern, setFilterPattern] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<ForecastRow | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const covered = rows.length;
  const sparse = rows.filter((r) => r.demand_pattern === "sparse" || r.data_points === null || (r.data_points ?? 0) < 30).length;
  const lumpy = rows.filter((r) => r.demand_pattern === "lumpy").length;

  const patternCounts: Record<string, number> = {};
  for (const r of rows) {
    const p = r.demand_pattern ?? "sparse";
    patternCounts[p] = (patternCounts[p] ?? 0) + 1;
  }

  const filtered = filterPattern ? rows.filter((r) => r.demand_pattern === filterPattern) : rows;

  // Sort: high quality first, then by recommended_rop desc (most urgent)
  const sorted = [...filtered].sort((a, b) => (b.fit_quality ?? 0) - (a.fit_quality ?? 0));

  // Top 5 for before/after comparison
  const comparisonRows = rows
    .filter((r) => r.recommended_rop !== null && r.det_rop !== null && r.fit_quality !== null && r.fit_quality >= 0.4)
    .sort((a, b) => Math.abs((b.recommended_rop ?? 0) - (b.det_rop ?? 0)) - Math.abs((a.recommended_rop ?? 0) - (a.det_rop ?? 0)))
    .slice(0, 5);

  async function runEngine() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/forecasts/run", { method: "POST" });
      const data = await res.json() as { products_processed?: number; products_skipped?: number; duration_ms?: number };
      setRunResult(
        `Done — ${data.products_processed ?? 0} models updated, ${data.products_skipped ?? 0} skipped. Took ${data.duration_ms ?? 0}ms.`
      );
      startTransition(() => { window.location.reload(); });
    } catch {
      setRunResult("Run failed — check logs.");
    }
    setRunning(false);
  }

  const lastRunLabel = lastRun
    ? (() => {
        const diff = Math.floor((Date.now() - new Date(lastRun).getTime()) / 60000);
        return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`;
      })()
    : "never";

  return (
    <div className="space-y-8">

      {/* ── 1. Coverage hero strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Forecast coverage", value: `${covered} / ${totalProducts}`, icon: CheckCircle2, color: "#4D7B3D" },
          { label: "Insufficient history", value: String(sparse), icon: HelpCircle, color: "#B47214" },
          { label: "Manual review needed", value: String(lumpy), icon: AlertTriangle, color: "#C54632" },
          { label: "Last full run", value: lastRunLabel, icon: RefreshCw, color: "#6B6B66" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl border border-[#E5E5E2] bg-white">
            <Icon size={14} style={{ color }} className="mb-2" />
            <p className="text-xl font-600 text-[#1A1A17]">{value}</p>
            <p className="text-[11px] text-[#9A9A93] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Run button */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={runEngine}
          disabled={running}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw size={11} className={running ? "animate-spin" : ""} />
          {running ? "Running models…" : "Run forecast engine"}
        </Button>
        {runResult && <p className="text-xs text-[#4D7B3D]">{runResult}</p>}
      </div>

      {/* ── 2. Demand pattern breakdown ───────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-600 text-[#1A1A17]">Demand pattern distribution</h2>
          {filterPattern && (
            <button onClick={() => setFilterPattern(null)} className="text-xs text-[#6B6B66] underline">
              Clear filter
            </button>
          )}
        </div>
        {rows.length > 0
          ? <PatternBar counts={patternCounts} total={rows.length} onFilter={setFilterPattern} />
          : <p className="text-sm text-[#9A9A93]">Run the forecast engine to see demand patterns.</p>
        }
      </div>

      {/* ── 3. Before/after comparison (top 5 biggest delta) ─────────────── */}
      {comparisonRows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-600 text-[#1A1A17]">
            Probabilistic vs simple formula — largest adjustments
          </h2>
          <div className="border border-[#E5E5E2] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
                  <th className="px-4 py-2.5 text-left font-600 text-[#9A9A93]">SKU</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Pattern</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Simple ROP</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Probabilistic ROP</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Delta</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((r) => {
                  const delta = (r.recommended_rop ?? 0) - (r.det_rop ?? 0);
                  const meta = patternMeta(r.demand_pattern);
                  return (
                    <tr
                      key={r.product_id}
                      className="border-b border-[#E5E5E2] last:border-0 hover:bg-[#FAFAF8] cursor-pointer"
                      onClick={() => setSelectedSku(r)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-500 text-[#1A1A17]">{r.sku}</p>
                        <p className="text-[11px] text-[#9A9A93]">{r.name}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-600" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#6B6B66] tabular-nums">{r.det_rop?.toFixed(0) ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-600 text-[#1A1A17] tabular-nums">{r.recommended_rop?.toFixed(0) ?? "—"}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-600", delta > 0 ? "text-[#4D7B3D]" : "text-[#C54632]")}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#9A9A93]">Click any row to see full model explanation.</p>
        </div>
      )}

      {/* ── 4. SKU drill-down panel ───────────────────────────────────────── */}
      {selectedSku && (
        <SkuDetailPanel row={selectedSku} onClose={() => setSelectedSku(null)} />
      )}

      {/* ── 5. Full SKU table ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-600 text-[#1A1A17]">
          {filterPattern ? `${patternMeta(filterPattern).label} SKUs` : "All forecasted SKUs"}
          {" "}
          <span className="text-[#9A9A93] font-400">({sorted.length})</span>
        </h2>

        {sorted.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <TrendingUp size={24} className="mx-auto text-[#E5E5E2]" />
            <p className="text-sm text-[#9A9A93]">No forecast data yet. Run the engine to build models.</p>
          </div>
        ) : (
          <div className="border border-[#E5E5E2] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
                  <th className="px-4 py-2.5 text-left font-600 text-[#9A9A93]">SKU</th>
                  <th className="px-4 py-2.5 text-left font-600 text-[#9A9A93]">Pattern</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">λ (daily)</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">LTD p95</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Prob. ROP</th>
                  <th className="px-4 py-2.5 text-right font-600 text-[#9A9A93]">Stock</th>
                  <th className="px-4 py-2.5 text-left font-600 text-[#9A9A93]">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const meta = patternMeta(r.demand_pattern);
                  const needsOrder = r.recommended_order_qty !== null && r.recommended_order_qty > 0;
                  return (
                    <tr
                      key={r.product_id}
                      onClick={() => setSelectedSku(r)}
                      className="border-b border-[#E5E5E2] last:border-0 hover:bg-[#FAFAF8] cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="font-500 text-[#1A1A17]">{r.sku}</p>
                        <p className="text-[11px] text-[#9A9A93] truncate max-w-[160px]">{r.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-600" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#1A1A17]">
                        {r.lambda != null ? r.lambda.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#1A1A17]">
                        {r.ltd_p95 != null ? r.ltd_p95.toFixed(0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-500 text-[#1A1A17]">
                        {r.recommended_rop != null ? r.recommended_rop.toFixed(0) : "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-500", needsOrder ? "text-[#C54632]" : "text-[#4D7B3D]")}>
                        {r.stock_on_hand}
                        {needsOrder && <span className="text-[10px] ml-1">↓ {r.recommended_order_qty?.toFixed(0)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ConfidenceChip q={r.fit_quality} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

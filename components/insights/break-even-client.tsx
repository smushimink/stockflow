"use client";

import { useState, useMemo } from "react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { ProductBreakEvenResult } from "@/lib/analytics/break-even";
import { calcNewProductBreakEven } from "@/lib/analytics/break-even";

interface Props {
  results: ProductBreakEvenResult[];
  warehouseCostMonthly: number | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProductBreakEvenResult["status"] }) {
  const map = {
    profitable: "bg-[#F2F8F0] text-[#4D7B3D]",
    marginal:   "bg-[#FDF8EE] text-[#B47214]",
    unprofitable: "bg-[#FDF2F0] text-[#C54632]",
  };
  return (
    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-600 capitalize", map[status])}>
      {status}
    </span>
  );
}

// ── SKU table ─────────────────────────────────────────────────────────────────

type SortKey = "status" | "sku" | "contribution" | "breakEven" | "monthly" | "months";

function SkuTable({ results }: { results: ProductBreakEvenResult[] }) {
  const [filter, setFilter] = useState<"all" | ProductBreakEvenResult["status"]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);

  const STATUS_ORDER = { unprofitable: 0, marginal: 1, profitable: 2 };

  const sorted = useMemo(() => {
    const visible = filter === "all" ? results : results.filter((r) => r.status === filter);
    return [...visible].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "status":    cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break;
        case "sku":       cmp = a.sku.localeCompare(b.sku); break;
        case "contribution": cmp = a.contributionMarginPerUnit - b.contributionMarginPerUnit; break;
        case "breakEven": cmp = a.breakEvenUnits - b.breakEvenUnits; break;
        case "monthly":   cmp = a.currentMonthlySales - b.currentMonthlySales; break;
        case "months":    cmp = (a.monthsToBreakEven ?? 999) - (b.monthsToBreakEven ?? 999); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [results, filter, sortKey, sortAsc]);

  function toggle(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => toggle(k)}
      className="px-3 py-2.5 text-left text-[10px] font-600 uppercase tracking-wider text-[#6B6B66] cursor-pointer hover:text-[#1A1A17] select-none whitespace-nowrap"
    >
      {label}{sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-2">
        {(["all", "unprofitable", "marginal", "profitable"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-500 border transition-colors capitalize",
              filter === f
                ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                : "bg-white border-[#E5E5E2] text-[#6B6B66] hover:bg-[#F7F7F5]"
            )}
          >
            {f === "all" ? `All (${results.length})` : `${f} (${results.filter((r) => r.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E5E2]">
        <table className="w-full text-xs border-collapse">
          <thead className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
            <tr>
              <Th k="sku" label="SKU / Product" />
              <Th k="status" label="Status" />
              <Th k="contribution" label="Margin/unit" />
              <Th k="breakEven" label="Break-even units" />
              <Th k="monthly" label="Monthly sales" />
              <Th k="months" label="Months to B/E" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6B6B66]">
                  No products match this filter.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.productId} className="border-b border-[#E5E5E2] last:border-0 hover:bg-[#FAFAFA]">
                  <td className="px-3 py-2.5">
                    <p className="font-500 text-[#1A1A17]">{r.sku}</p>
                    <p className="text-[10px] text-[#6B6B66] truncate max-w-[180px]" title={r.name}>{r.name}</p>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2.5 tabular-nums text-[#1A1A17]">
                    <span className={cn(r.contributionMarginPerUnit < 0 ? "text-[#C54632]" : "")}>
                      {formatCurrency(r.contributionMarginPerUnit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[#1A1A17]">
                    {r.breakEvenUnits > 0 ? r.breakEvenUnits : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[#1A1A17]">
                    {r.currentMonthlySales.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.monthsToBreakEven !== null ? (
                      <span className={cn(r.monthsToBreakEven > 6 ? "text-[#C54632]" : r.monthsToBreakEven > 3 ? "text-[#B47214]" : "text-[#4D7B3D]")}>
                        {r.monthsToBreakEven.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#C8C8C4]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Fixed cost coverage ───────────────────────────────────────────────────────

function FixedCostCoverage({ results, warehouseCostMonthly }: { results: ProductBreakEvenResult[]; warehouseCostMonthly: number | null }) {
  if (!warehouseCostMonthly || warehouseCostMonthly <= 0) {
    return (
      <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-5">
        <p className="text-sm text-[#6B6B66]">
          Set your monthly warehouse cost in <strong className="text-[#1A1A17]">Settings → Business profile</strong> to enable fixed-cost coverage analysis.
        </p>
      </div>
    );
  }

  const totalMonthlyContribution = results.reduce(
    (s, r) => s + r.currentMonthlySales * r.contributionMarginPerUnit,
    0
  );
  const coveragePct = (totalMonthlyContribution / warehouseCostMonthly) * 100;
  const covered = coveragePct >= 100;

  return (
    <div className="rounded-xl border border-[#E5E5E2] bg-white p-5 space-y-3">
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-600 text-[#1A1A17] tabular-nums">
          {Math.round(coveragePct)}%
        </p>
        <p className={cn("text-sm font-500", covered ? "text-[#4D7B3D]" : "text-[#C54632]")}>
          {covered ? "Fixed costs covered" : "Fixed costs not covered"}
        </p>
      </div>
      <div className="h-2 rounded-full bg-[#E5E5E2] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", covered ? "bg-[#4D7B3D]" : "bg-[#C54632]")}
          style={{ width: `${Math.min(100, coveragePct)}%` }}
        />
      </div>
      <p className="text-xs text-[#6B6B66]">
        Monthly gross contribution: {formatCurrency(totalMonthlyContribution)} ·
        Monthly warehouse cost: {formatCurrency(warehouseCostMonthly)}.
        {!covered && " The business is structurally unprofitable at current sales volumes."}
      </p>
    </div>
  );
}

// ── Category break-even bars ──────────────────────────────────────────────────

function CategoryBreakEvenBars({ results }: { results: ProductBreakEvenResult[] }) {
  const categories = useMemo(() => {
    const map = new Map<string, { totalBreakEven: number; totalMonthly: number }>();
    for (const r of results) {
      const key = r.category ?? "Uncategorised";
      const prev = map.get(key) ?? { totalBreakEven: 0, totalMonthly: 0 };
      map.set(key, {
        totalBreakEven: prev.totalBreakEven + r.breakEvenUnits,
        totalMonthly: prev.totalMonthly + r.currentMonthlySales,
      });
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        daysToBreakEven: v.totalMonthly > 0 ? (v.totalBreakEven / v.totalMonthly) * 30 : null,
      }))
      .sort((a, b) => (b.daysToBreakEven ?? 0) - (a.daysToBreakEven ?? 0));
  }, [results]);

  const maxDays = Math.max(...categories.map((c) => c.daysToBreakEven ?? 0), 1);

  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const days = cat.daysToBreakEven;
        const pct = days !== null ? Math.min(100, (days / maxDays) * 100) : 0;
        const color =
          days === null ? "bg-[#E5E5E2]"
          : days > 90 ? "bg-[#C54632]"
          : days > 45 ? "bg-[#B47214]"
          : "bg-[#4D7B3D]";

        return (
          <div key={cat.name} className="flex items-center gap-3">
            <p className="w-32 text-xs text-[#1A1A17] truncate shrink-0 capitalize" title={cat.name}>
              {cat.name}
            </p>
            <div className="flex-1 h-4 rounded bg-[#F0F0EE] overflow-hidden">
              <div className={cn("h-full rounded transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
            <p className="w-16 text-xs tabular-nums text-right text-[#6B6B66] shrink-0">
              {days !== null ? `${Math.round(days)}d` : "—"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── What-if calculator ────────────────────────────────────────────────────────

function WhatIfCalculator({ results }: { results: ProductBreakEvenResult[] }) {
  const [selectedId, setSelectedId] = useState(results[0]?.productId ?? "");
  const [priceMultiplier, setPriceMultiplier] = useState(100);   // % of current
  const [volumeMultiplier, setVolumeMultiplier] = useState(100); // % of current

  const product = results.find((r) => r.productId === selectedId);

  const scenario = useMemo(() => {
    if (!product) return null;
    const newPrice = product.sellingPrice * (priceMultiplier / 100);
    const newMonthlyVolume = product.currentMonthlySales * (volumeMultiplier / 100);
    const newMargin = newPrice - product.unitCost;
    const newMonthlyContribution = newMargin * newMonthlyVolume;
    const beUnits = newMargin > 0 && product.fixedCostAllocation > 0
      ? Math.ceil(product.fixedCostAllocation / newMargin)
      : 0;
    const months = newMonthlyVolume > 0 && beUnits > 0
      ? beUnits / newMonthlyVolume
      : null;

    const status: ProductBreakEvenResult["status"] =
      newMargin <= 0 ? "unprofitable"
      : beUnits === 0 || newMonthlyVolume >= beUnits ? "profitable"
      : newMonthlyVolume >= beUnits * 0.8 ? "marginal"
      : "unprofitable";

    return { newPrice, newMonthlyVolume, newMargin, newMonthlyContribution, beUnits, months, status };
  }, [product, priceMultiplier, volumeMultiplier]);

  if (!product || !scenario) return null;

  return (
    <div className="rounded-xl border border-[#E5E5E2] bg-white p-5 space-y-4">
      {/* Product picker */}
      <div>
        <label className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] block mb-1.5">Product</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full text-sm border border-[#E5E5E2] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20"
        >
          {results.map((r) => (
            <option key={r.productId} value={r.productId}>
              {r.sku} — {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Price slider */}
        <div>
          <div className="flex justify-between text-[10px] text-[#6B6B66] mb-1.5">
            <span className="uppercase tracking-wider font-600">Price</span>
            <span className="tabular-nums">{formatCurrency(scenario.newPrice)} ({priceMultiplier}%)</span>
          </div>
          <input
            type="range" min={50} max={200} step={5}
            value={priceMultiplier}
            onChange={(e) => setPriceMultiplier(Number(e.target.value))}
            className="w-full accent-[#1A1A17]"
          />
          <div className="flex justify-between text-[10px] text-[#C8C8C4] mt-0.5">
            <span>−50%</span><span>Current</span><span>+100%</span>
          </div>
        </div>

        {/* Volume slider */}
        <div>
          <div className="flex justify-between text-[10px] text-[#6B6B66] mb-1.5">
            <span className="uppercase tracking-wider font-600">Volume</span>
            <span className="tabular-nums">{scenario.newMonthlyVolume.toFixed(1)}/mo ({volumeMultiplier}%)</span>
          </div>
          <input
            type="range" min={0} max={300} step={10}
            value={volumeMultiplier}
            onChange={(e) => setVolumeMultiplier(Number(e.target.value))}
            className="w-full accent-[#1A1A17]"
          />
          <div className="flex justify-between text-[10px] text-[#C8C8C4] mt-0.5">
            <span>0</span><span>Current</span><span>3×</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-4 gap-3 pt-1">
        {[
          { label: "Margin/unit", value: formatCurrency(scenario.newMargin) },
          { label: "Monthly contribution", value: formatCurrency(scenario.newMonthlyContribution) },
          { label: "Break-even units", value: scenario.beUnits > 0 ? String(scenario.beUnits) : "—" },
          { label: "Months to B/E", value: scenario.months !== null ? scenario.months.toFixed(1) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-[#F7F7F5] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">{label}</p>
            <p className="text-sm font-500 text-[#1A1A17] tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <StatusBadge status={scenario.status} />
        <span className="text-xs text-[#6B6B66]">
          {scenario.status === "profitable" && "This scenario covers fixed costs at current volume."}
          {scenario.status === "marginal" && "Close to break-even — small volume increase would tip to profitable."}
          {scenario.status === "unprofitable" && scenario.newMargin <= 0 && "Selling below cost. Raise price above " + formatCurrency(product.unitCost) + "."}
          {scenario.status === "unprofitable" && scenario.newMargin > 0 && "Needs higher volume or lower fixed cost allocation."}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BreakEvenClient({ results, warehouseCostMonthly }: Props) {
  const profitable = results.filter((r) => r.status === "profitable").length;
  const marginal   = results.filter((r) => r.status === "marginal").length;
  const unprofitable = results.filter((r) => r.status === "unprofitable").length;

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-8 text-center space-y-2">
        <p className="text-sm font-500 text-[#1A1A17]">No product data</p>
        <p className="text-sm text-[#6B6B66]">
          Add products and sales data, then run the decision engine to populate break-even analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Profitable",   value: profitable,   color: "text-[#4D7B3D]" },
          { label: "Marginal",     value: marginal,     color: "text-[#B47214]" },
          { label: "Unprofitable", value: unprofitable, color: "text-[#C54632]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E5E5E2] bg-white p-4 text-center">
            <p className={cn("text-3xl font-600 tabular-nums", color)}>{value}</p>
            <p className="text-xs text-[#6B6B66] mt-0.5">{label} SKUs</p>
          </div>
        ))}
      </div>

      {/* Fixed cost coverage */}
      <section className="space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Fixed cost coverage</p>
        <FixedCostCoverage results={results} warehouseCostMonthly={warehouseCostMonthly} />
      </section>

      {/* SKU table */}
      <section className="space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU break-even status</p>
        <SkuTable results={results} />
      </section>

      {/* Category bars */}
      <section className="space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
          Days to break-even by category
        </p>
        <p className="text-xs text-[#6B6B66]">
          How many days each category takes to recover its allocated fixed costs at current sales pace.
        </p>
        <CategoryBreakEvenBars results={results} />
      </section>

      {/* What-if calculator */}
      <section className="space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">What-if calculator</p>
        <WhatIfCalculator results={results} />
      </section>

    </div>
  );
}

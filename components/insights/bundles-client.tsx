"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketBasketResult, AssociationRule } from "@/lib/analytics/market-basket";

interface Props {
  result: MarketBasketResult;
}

function LiftBadge({ lift }: { lift: number }) {
  const color =
    lift >= 3 ? "bg-[#F2F8F0] text-[#4D7B3D]" :
    lift >= 2 ? "bg-[#FDF8EE] text-[#B47214]" :
    "bg-[#F7F7F5] text-[#6B6B66]";
  return (
    <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded tabular-nums ${color}`}>
      {lift.toFixed(2)}×
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "#4D7B3D" : pct >= 50 ? "#B47214" : "#6B6B66";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-[#F0F0EE] rounded-full h-1.5 shrink-0">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Bundle card for strong associations ──────────────────────────────────────

function BundleCard({ rule }: { rule: AssociationRule }) {
  const pct = Math.round(rule.confidence * 100);
  const isStrong = rule.lift >= 3;
  return (
    <div
      className={cn(
        "border rounded-lg p-4 space-y-2",
        isStrong
          ? "bg-[#F2F8F0] border-[#4D7B3D]/20"
          : "bg-[#FDF8EE] border-[#B47214]/20"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-600 text-[#1A1A17]">{rule.product_a_sku}</span>
          <span className="text-[#C8C8C4] text-xs">+</span>
          <span className="text-sm font-600 text-[#1A1A17]">{rule.product_b_sku}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isStrong && (
            <span className="text-[9px] font-700 px-1.5 py-0.5 rounded bg-[#4D7B3D] text-white uppercase tracking-wider">
              Bundle
            </span>
          )}
          <LiftBadge lift={rule.lift} />
        </div>
      </div>

      {/* Product names */}
      <p className="text-[11px] text-[#6B6B66]">
        {rule.product_a_name}
        {" · "}
        {rule.product_b_name}
      </p>

      {/* Insight */}
      <p className="text-xs text-[#1A1A17] leading-relaxed">{rule.insight}</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] text-[#6B6B66] pt-1 border-t border-black/5">
        <span>
          Co-purchased in <strong className="text-[#1A1A17]">{rule.co_count}</strong> orders
        </span>
        <span>
          Support <strong className="text-[#1A1A17] tabular-nums">{(rule.support * 100).toFixed(1)}%</strong>
        </span>
        <span>
          Confidence <strong className="text-[#1A1A17] tabular-nums">{pct}%</strong>
        </span>
      </div>

      {/* Bundle suggestion */}
      {rule.lift >= 2 && (
        <div className="bg-white/60 rounded px-2.5 py-2 text-xs text-[#6B6B66]">
          <span className="font-600 text-[#1A1A17]">Bundle suggestion:</span>{" "}
          Package {rule.product_a_sku} + {rule.product_b_sku} together with a 5% discount.
          This combination appears in {pct}% of {rule.product_a_sku} orders — a bundle SKU could increase
          average order value and simplify purchasing for repeat buyers.
        </div>
      )}
    </div>
  );
}

// ── Full association table ────────────────────────────────────────────────────

type SortKey = "lift" | "confidence" | "support" | "co_count";

function AssociationTable({ rules }: { rules: AssociationRule[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("lift");

  const sorted = [...rules].sort((a, b) => b[sortKey] - a[sortKey]);

  function Th({
    k,
    label,
    right,
  }: {
    k: SortKey;
    label: string;
    right?: boolean;
  }) {
    return (
      <th
        className={cn(
          "px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider cursor-pointer hover:text-[#1A1A17] transition-colors",
          right ? "text-right" : "text-left",
          sortKey === k && "text-[#1A1A17]"
        )}
        onClick={() => setSortKey(k)}
      >
        {label} {sortKey === k && "↓"}
      </th>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E5E2]">
            <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              If bought
            </th>
            <th className="px-2 py-2" />
            <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Also bought
            </th>
            <Th k="confidence" label="Confidence" right />
            <Th k="support" label="Support" right />
            <Th k="lift" label="Lift" right />
            <Th k="co_count" label="Orders" right />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E2]">
          {sorted.map((rule, i) => (
            <tr key={i} className="hover:bg-[#F7F7F5]">
              <td className="px-4 py-2.5">
                <p className="text-xs font-500 text-[#1A1A17]">{rule.product_a_sku}</p>
                <p className="text-[11px] text-[#6B6B66] truncate max-w-[160px]">
                  {rule.product_a_name}
                </p>
              </td>
              <td className="px-1 py-2.5 text-[#C8C8C4] text-xs text-center">→</td>
              <td className="px-4 py-2.5">
                <p className="text-xs font-500 text-[#1A1A17]">{rule.product_b_sku}</p>
                <p className="text-[11px] text-[#6B6B66] truncate max-w-[160px]">
                  {rule.product_b_name}
                </p>
              </td>
              <td className="px-4 py-2.5">
                <ConfidenceBar value={rule.confidence} />
              </td>
              <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#6B6B66]">
                {(rule.support * 100).toFixed(1)}%
              </td>
              <td className="px-4 py-2.5 text-right">
                <LiftBadge lift={rule.lift} />
              </td>
              <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#6B6B66]">
                {rule.co_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BundlesClient({ result }: Props) {
  const { rules, total_orders, eligible_products, insufficient_data, message } = result;

  if (insufficient_data) {
    return (
      <div className="bg-white border border-[#E5E5E2] rounded-lg py-16 text-center space-y-2">
        <p className="text-sm font-500 text-[#1A1A17]">Not enough data yet</p>
        <p className="text-xs text-[#6B6B66] max-w-sm mx-auto">{message}</p>
        <p className="text-[11px] text-[#C8C8C4]">
          {total_orders} completed orders analysed · {eligible_products} eligible products
        </p>
      </div>
    );
  }

  const strongRules = rules.filter((r) => r.lift >= 2).slice(0, 8);
  const medianLift =
    rules.length > 0
      ? rules[Math.floor(rules.length / 2)].lift
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Orders analysed" value={String(total_orders)} />
        <StatCard label="Eligible products" value={String(eligible_products)} />
        <StatCard label="Association rules" value={String(rules.length)} />
        <StatCard
          label="Median lift"
          value={rules.length > 0 ? `${medianLift.toFixed(2)}×` : "—"}
          sub="≥ 1.0 = positive association"
        />
      </div>

      {/* Bundle opportunities */}
      {strongRules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
            Bundle opportunities
            <span className="ml-2 text-[#C8C8C4] font-400 normal-case">
              lift ≥ 2× — strong co-purchase signal
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {strongRules.map((rule, i) => (
              <BundleCard key={i} rule={rule} />
            ))}
          </div>
        </section>
      )}

      {/* Explainer */}
      <div className="bg-[#F0ECFA] border border-[#5B3FA8]/15 rounded-lg px-4 py-3">
        <p className="text-xs font-600 text-[#5B3FA8] uppercase tracking-wider mb-1">
          How to read this
        </p>
        <p className="text-xs text-[#1A1A17] leading-relaxed">
          <strong>Confidence</strong> = how often B is bought when A is bought.{" "}
          <strong>Support</strong> = how often both appear in the same order (out of all orders).{" "}
          <strong>Lift</strong> = how much more likely B is given A vs. buying B at random — lift{" "}
          {">"} 1 means positive association, {">"} 2 means strong.
        </p>
        <p className="text-xs text-[#6B6B66] mt-1">
          Practical actions: reorganise your catalogue so these SKUs appear together, create bundle
          SKUs with slight discounts, or add cross-sell prompts on order confirmation emails.
        </p>
      </div>

      {/* Full table */}
      {rules.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
            All association rules
            <span className="ml-2 text-[#C8C8C4] font-400 normal-case">
              click column header to sort
            </span>
          </h2>
          <AssociationTable rules={rules} />
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-lg font-600 tabular-nums text-[#1A1A17]">{value}</p>
      {sub && <p className="text-[10px] text-[#C8C8C4]">{sub}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { CustomerOrder } from "@/app/(dashboard)/customers/[id]/page";

export interface ProfitDeepDiveData {
  productCategories: Record<string, string | null>;
  orgAvgMarginPct: number | null;
  categoryOrgMargins: Record<string, number>;
  predictedClv: number | null;
  orgAvgClv: number | null;
}

interface Props {
  orders: CustomerOrder[];
  deepDive: ProfitDeepDiveData;
  customerTotalSpent: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mean(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function slope(ys: number[]) {
  if (ys.length < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

function itemProfit(i: CustomerOrder["items"][number]) {
  return i.qty * i.unit_price - i.qty * i.unit_cost - i.discount;
}

// ── Monthly profit timeline ───────────────────────────────────────────────────

function MonthlyProfitSection({ orders }: { orders: CustomerOrder[] }) {
  const now = new Date();
  const months: Array<{ key: string; label: string; profit: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
    months.push({ key, label, profit: 0 });
  }

  const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "delivered");
  for (const o of completedOrders) {
    const d = new Date(o.ordered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((m) => m.key === key);
    if (m) m.profit += o.items.reduce((s, i) => s + itemProfit(i), 0);
  }

  const profits = months.map((m) => m.profit);
  const maxP = Math.max(...profits, 1);
  const minP = Math.min(...profits, 0);
  const range = maxP - minP || 1;
  const trendSlope = slope(profits.filter((_, i) => i >= 6));
  const sd = stdDev(profits);
  const avg = mean(profits);
  const hasSeasonality = avg > 0 && sd / avg > 0.35;
  const W = 520;
  const H = 120;
  const barW = Math.floor(W / 12) - 3;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Monthly profit — last 12 months
      </h3>
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
        <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
          {months.map((m, i) => {
            const x = i * (W / 12);
            const h = ((m.profit - minP) / range) * H;
            const y = H - h;
            const color = m.profit >= 0 ? "#4D7B3D" : "#C54632";
            return (
              <g key={m.key}>
                <rect
                  x={x + 2}
                  y={y}
                  width={barW}
                  height={h}
                  fill={color}
                  fillOpacity={0.75}
                  rx={2}
                />
                <text
                  x={x + barW / 2 + 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#6B6B66"
                >
                  {m.label}
                </text>
              </g>
            );
          })}
          {/* zero line */}
          {minP < 0 && (
            <line
              x1={0}
              y1={H - ((0 - minP) / range) * H}
              x2={W}
              y2={H - ((0 - minP) / range) * H}
              stroke="#E5E5E2"
              strokeWidth={1}
            />
          )}
          {/* trend line over last 6 months */}
          {(() => {
            const last6 = profits.slice(6);
            const x0 = 6 * (W / 12) + barW / 2 + 2;
            const x1 = 11 * (W / 12) + barW / 2 + 2;
            const y0 = H - ((last6[0] - minP) / range) * H;
            const y1 = H - ((last6[5] - minP) / range) * H;
            return (
              <line
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke={trendSlope >= 0 ? "#4D7B3D" : "#C54632"}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            );
          })()}
        </svg>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {trendSlope > 0 && (
            <span className="text-xs text-[#4D7B3D] font-500">↑ Trending up (last 6 months)</span>
          )}
          {trendSlope < 0 && (
            <span className="text-xs text-[#C54632] font-500">↓ Trending down (last 6 months)</span>
          )}
          {hasSeasonality && (
            <span className="text-xs text-[#B47214] font-500">~ Seasonal variation detected</span>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Per-product margin analysis ───────────────────────────────────────────────

interface ProductRow {
  key: string;
  sku: string;
  name: string;
  category: string | null;
  revenue: number;
  profit: number;
  marginPct: number;
}

function PerProductSection({
  orders,
  deepDive,
}: {
  orders: CustomerOrder[];
  deepDive: ProfitDeepDiveData;
}) {
  const map = new Map<string, ProductRow>();
  const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "delivered");
  for (const o of completedOrders) {
    for (const item of o.items) {
      const key = item.product_id ?? item.sku;
      const p = itemProfit(item);
      const existing = map.get(key);
      if (existing) {
        existing.revenue += item.total;
        existing.profit += p;
      } else {
        map.set(key, {
          key,
          sku: item.sku,
          name: item.name,
          category: item.product_id ? (deepDive.productCategories[item.product_id] ?? null) : null,
          revenue: item.total,
          profit: p,
          marginPct: 0,
        });
      }
    }
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    marginPct: r.revenue > 0 ? r.profit / r.revenue : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const orgAvg = deepDive.orgAvgMarginPct;

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Per-product margin
        {orgAvg !== null && (
          <span className="ml-2 font-400 normal-case text-[#C8C8C4]">
            org avg {(orgAvg * 100).toFixed(1)}%
          </span>
        )}
      </h3>
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Product
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Revenue
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Profit
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Margin
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                vs org
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {rows.map((r) => {
              const catAvg = r.category ? deepDive.categoryOrgMargins[r.category] : undefined;
              const baseline = catAvg ?? orgAvg;
              const delta = baseline !== null && baseline !== undefined ? r.marginPct - baseline : null;
              return (
                <tr key={r.key} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-500 text-[#1A1A17]">{r.sku}</p>
                    <p className="text-[11px] text-[#6B6B66] truncate max-w-[180px]">{r.name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#6B6B66]">
                    {formatCurrency(r.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums font-500"
                    style={{ color: r.profit >= 0 ? "#1A1A17" : "#C54632" }}>
                    {formatCurrency(r.profit)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums font-500"
                    style={{ color: r.marginPct >= 0.25 ? "#4D7B3D" : r.marginPct >= 0.15 ? "#B47214" : "#C54632" }}>
                    {(r.marginPct * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    {delta !== null ? (
                      <span style={{ color: delta >= 0 ? "#4D7B3D" : "#C54632" }}>
                        {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}pp
                      </span>
                    ) : (
                      <span className="text-[#C8C8C4]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Product mix by category ───────────────────────────────────────────────────

function CategoryMixSection({
  orders,
  deepDive,
}: {
  orders: CustomerOrder[];
  deepDive: ProfitDeepDiveData;
}) {
  const catMap = new Map<string, { revenue: number; profit: number }>();
  const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "delivered");
  for (const o of completedOrders) {
    for (const item of o.items) {
      const cat = (item.product_id ? deepDive.productCategories[item.product_id] : null) ?? "Uncategorised";
      const p = itemProfit(item);
      const existing = catMap.get(cat);
      if (existing) {
        existing.revenue += item.total;
        existing.profit += p;
      } else {
        catMap.set(cat, { revenue: item.total, profit: p });
      }
    }
  }

  const cats = [...catMap.entries()]
    .map(([cat, data]) => ({
      cat,
      ...data,
      marginPct: data.revenue > 0 ? data.profit / data.revenue : 0,
      orgMarginPct: deepDive.categoryOrgMargins[cat] ?? deepDive.orgAvgMarginPct,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = cats.reduce((s, c) => s + c.revenue, 0);

  if (cats.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Product mix by category
      </h3>
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden divide-y divide-[#E5E5E2]">
        {cats.map((c) => {
          const sharePct = totalRevenue > 0 ? c.revenue / totalRevenue : 0;
          const delta = c.orgMarginPct !== null ? c.marginPct - c.orgMarginPct : null;
          return (
            <div key={c.cat} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-500 text-[#1A1A17]">{c.cat}</span>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-[#6B6B66]">{formatCurrency(c.revenue)}</span>
                  <span
                    className="font-500"
                    style={{ color: c.marginPct >= 0.25 ? "#4D7B3D" : c.marginPct >= 0.15 ? "#B47214" : "#C54632" }}
                  >
                    {(c.marginPct * 100).toFixed(1)}%
                  </span>
                  {delta !== null && (
                    <span style={{ color: delta >= 0 ? "#4D7B3D" : "#C54632" }} className="font-500">
                      ({delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}pp vs org)
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-[#F0F0EE] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(sharePct * 100)}%`,
                    background: c.marginPct >= 0.25 ? "#4D7B3D" : c.marginPct >= 0.15 ? "#B47214" : "#C54632",
                  }}
                />
              </div>
              <p className="text-[10px] text-[#C8C8C4] mt-1">
                {(sharePct * 100).toFixed(0)}% of revenue
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Behavioral signals ────────────────────────────────────────────────────────

function BehaviorSection({
  orders,
  deepDive,
}: {
  orders: CustomerOrder[];
  deepDive: ProfitDeepDiveData;
}) {
  const completed = orders
    .filter((o) => o.status === "completed" || o.status === "delivered")
    .sort((a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime());

  const intervals: number[] = [];
  for (let i = 1; i < completed.length; i++) {
    const gap =
      (new Date(completed[i].ordered_at).getTime() - new Date(completed[i - 1].ordered_at).getTime()) /
      (24 * 3600 * 1000);
    intervals.push(Math.round(gap));
  }

  const avgInterval = mean(intervals);
  const intervalSlope = slope(intervals);
  const returnsCount = orders.filter((o) => o.status === "refunded").length;
  const returnsRate = orders.length > 0 ? returnsCount / orders.length : 0;

  const { predictedClv, orgAvgClv } = deepDive;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Behavioral signals
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Order cadence */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-3">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            Order cadence
          </p>
          {intervals.length === 0 ? (
            <p className="text-xs text-[#C8C8C4]">Not enough orders to compute intervals.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B66]">Avg interval</span>
                  <span className="text-sm font-600 text-[#1A1A17] tabular-nums">
                    {avgInterval.toFixed(0)}d
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B66]">Trend</span>
                  <span
                    className="text-xs font-500 tabular-nums"
                    style={{ color: intervalSlope <= 0 ? "#4D7B3D" : "#C54632" }}
                  >
                    {intervalSlope <= -0.5
                      ? "Ordering more frequently"
                      : intervalSlope >= 0.5
                      ? "Ordering less frequently"
                      : "Stable"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B66]">Returns rate</span>
                  <span
                    className="text-xs font-500 tabular-nums"
                    style={{ color: returnsRate > 0.1 ? "#C54632" : "#1A1A17" }}
                  >
                    {(returnsRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Mini interval sparkline */}
              {intervals.length >= 3 && (
                <svg viewBox={`0 0 120 32`} className="w-full">
                  {intervals.map((v, i) => {
                    const maxI = Math.max(...intervals, 1);
                    const x = (i / (intervals.length - 1)) * 110 + 5;
                    const y = 28 - (v / maxI) * 24;
                    return (
                      <circle key={i} cx={x} cy={y} r={2.5} fill="#1A1A17" fillOpacity={0.5} />
                    );
                  })}
                  <polyline
                    points={intervals
                      .map((v, i) => {
                        const maxI = Math.max(...intervals, 1);
                        const x = (i / (intervals.length - 1)) * 110 + 5;
                        const y = 28 - (v / maxI) * 24;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#1A1A17"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  />
                </svg>
              )}
            </>
          )}
        </div>

        {/* CLV prediction */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-3">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            CLV prediction
          </p>
          {predictedClv !== null ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B6B66]">Predicted lifetime value</span>
                  <span
                    className="text-sm font-600 tabular-nums"
                    style={{
                      color:
                        orgAvgClv !== null && predictedClv >= orgAvgClv ? "#4D7B3D" : "#1A1A17",
                    }}
                  >
                    {formatCurrency(predictedClv)}
                  </span>
                </div>
                {orgAvgClv !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6B66]">Org avg CLV</span>
                    <span className="text-xs tabular-nums text-[#6B6B66]">
                      {formatCurrency(orgAvgClv)}
                    </span>
                  </div>
                )}
                {orgAvgClv !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6B66]">vs avg</span>
                    <span
                      className="text-xs font-500 tabular-nums"
                      style={{ color: predictedClv >= orgAvgClv ? "#4D7B3D" : "#C54632" }}
                    >
                      {predictedClv >= orgAvgClv ? "+" : ""}
                      {formatCurrency(predictedClv - orgAvgClv)}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#C8C8C4]">
                Based on org-wide CLV regression model.
              </p>
            </>
          ) : (
            <p className="text-xs text-[#C8C8C4]">
              Insufficient org data to run CLV model.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Renegotiation calculator ──────────────────────────────────────────────────

function RenegotiationSection({
  orders,
  customerTotalSpent,
}: {
  orders: CustomerOrder[];
  customerTotalSpent: number;
}) {
  const [targetMarginPct, setTargetMarginPct] = useState(25);

  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const orders12m = orders.filter(
    (o) =>
      (o.status === "completed" || o.status === "delivered") &&
      new Date(o.ordered_at) >= cutoff
  );
  const totalRevenue12m = orders12m.reduce((s, o) => s + o.total, 0);
  const totalProfit12m = orders12m.reduce(
    (s, o) => s + o.items.reduce((si, i) => si + itemProfit(i), 0),
    0
  );
  const currentMarginPct = totalRevenue12m > 0 ? (totalProfit12m / totalRevenue12m) * 100 : 0;

  const targetProfit12m = totalRevenue12m * (targetMarginPct / 100);
  const profitDelta = targetProfit12m - totalProfit12m;

  const lifetimeOrders = orders.filter((o) => o.status === "completed" || o.status === "delivered");
  const lifetimeProfit = lifetimeOrders.reduce(
    (s, o) => s + o.items.reduce((si, i) => si + itemProfit(i), 0),
    0
  );
  const lifetimeMarginPct = customerTotalSpent > 0 ? (lifetimeProfit / customerTotalSpent) * 100 : 0;
  const targetLifetimeProfit = customerTotalSpent * (targetMarginPct / 100);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Renegotiation calculator
      </h3>
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-5 space-y-5">
        {totalRevenue12m === 0 ? (
          <p className="text-xs text-[#C8C8C4] text-center py-4">
            No completed orders in the last 12 months.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-[#6B6B66] uppercase tracking-wider">Current margin (12m)</p>
                <p
                  className="text-xl font-600 tabular-nums mt-1"
                  style={{
                    color:
                      currentMarginPct >= 25 ? "#4D7B3D" : currentMarginPct >= 15 ? "#B47214" : "#C54632",
                  }}
                >
                  {currentMarginPct.toFixed(1)}%
                </p>
                <p className="text-xs text-[#6B6B66]">{formatCurrency(totalProfit12m)} profit</p>
              </div>
              <div className="flex items-center justify-center text-[#C8C8C4]">→</div>
              <div>
                <p className="text-[10px] text-[#6B6B66] uppercase tracking-wider">Target margin</p>
                <p className="text-xl font-600 tabular-nums text-[#1A1A17] mt-1">
                  {targetMarginPct}%
                </p>
                <p className="text-xs text-[#4D7B3D] font-500">
                  {formatCurrency(targetProfit12m)} profit
                </p>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#6B6B66]">
                <span>15%</span>
                <span className="font-500 text-[#1A1A17]">Target: {targetMarginPct}%</span>
                <span>50%</span>
              </div>
              <input
                type="range"
                min={15}
                max={50}
                step={1}
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                className="w-full accent-[#1A1A17]"
              />
            </div>

            {/* Impact summary */}
            <div className="rounded-lg bg-[#F7F7F5] border border-[#E5E5E2] px-4 py-3 space-y-2">
              <p className="text-xs text-[#6B6B66]">
                If you renegotiated pricing to{" "}
                <span className="font-600 text-[#1A1A17]">{targetMarginPct}% margin</span>:
              </p>
              <p className="text-sm text-[#1A1A17]">
                12-month profit changes from{" "}
                <span className="font-600">{formatCurrency(totalProfit12m)}</span> to{" "}
                <span className="font-600 text-[#4D7B3D]">{formatCurrency(targetProfit12m)}</span>
                {profitDelta !== 0 && (
                  <>
                    {" "}
                    (
                    <span
                      className="font-600"
                      style={{ color: profitDelta >= 0 ? "#4D7B3D" : "#C54632" }}
                    >
                      {profitDelta >= 0 ? "+" : ""}
                      {formatCurrency(profitDelta)}
                    </span>
                    )
                  </>
                )}
              </p>
              <p className="text-sm text-[#1A1A17]">
                Lifetime profit changes from{" "}
                <span className="font-600">{formatCurrency(lifetimeProfit)}</span> to{" "}
                <span className="font-600 text-[#4D7B3D]">{formatCurrency(targetLifetimeProfit)}</span>
                {lifetimeMarginPct.toFixed(1) !== targetMarginPct.toFixed(1) && (
                  <>
                    {" "}(was {lifetimeMarginPct.toFixed(1)}%, would be {targetMarginPct}%)
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CustomerProfitDeepDive({ orders, deepDive, customerTotalSpent }: Props) {
  return (
    <div className="space-y-6">
      <MonthlyProfitSection orders={orders} />
      <PerProductSection orders={orders} deepDive={deepDive} />
      <CategoryMixSection orders={orders} deepDive={deepDive} />
      <BehaviorSection orders={orders} deepDive={deepDive} />
      <RenegotiationSection orders={orders} customerTotalSpent={customerTotalSpent} />
    </div>
  );
}

"use client";

import { formatCurrency } from "@/lib/utils";
import type { SupplierPo, SupplierProduct } from "@/app/(dashboard)/suppliers/[id]/page";

export interface SupplierEconomicData {
  orgRevenue90d: number;
  orgLeadTimeDays: number[];
  orgTotalPoSpend12m: number;
  supplierPoSpend12m: number;
  orgAbcACount: number;
}

interface Props {
  pos: SupplierPo[];
  products: SupplierProduct[];
  economic: SupplierEconomicData;
  promisedLeadTime: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mean(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function InsightBanner({
  color,
  text,
}: {
  color: "green" | "amber" | "red";
  text: string;
}) {
  const styles = {
    green: { bg: "bg-[#F2F8F0]", border: "border-[#4D7B3D]/20", dot: "bg-[#4D7B3D]", text: "text-[#1A1A17]" },
    amber: { bg: "bg-[#FDF8EE]", border: "border-[#B47214]/20", dot: "bg-[#B47214]", text: "text-[#1A1A17]" },
    red:   { bg: "bg-[#FDF2F0]", border: "border-[#C54632]/20", dot: "bg-[#C54632]", text: "text-[#1A1A17]" },
  }[color];
  return (
    <div className={`flex items-start gap-3 ${styles.bg} border ${styles.border} rounded-lg px-4 py-3`}>
      <div className={`w-2 h-2 rounded-full ${styles.dot} mt-1 shrink-0`} />
      <p className={`text-sm ${styles.text}`}>{text}</p>
    </div>
  );
}

function NoData({ msg }: { msg: string }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg py-8 text-center text-xs text-[#6B6B66]">
      {msg}
    </div>
  );
}

// ── Section 1: Cost Trend ─────────────────────────────────────────────────────

function CostTrendSection({ pos, products }: { pos: SupplierPo[]; products: SupplierProduct[] }) {
  const now = Date.now();
  const twelveM = 365 * 86400000;

  // Build cost history per product from received POs
  const histMap = new Map<
    string,
    { sku: string; name: string; obs: Array<{ date: string; cost: number }> }
  >();
  for (const po of pos) {
    if (po.status !== "received") continue;
    for (const item of po.items) {
      if (!item.product_id || item.unit_cost <= 0) continue;
      const key = item.product_id;
      if (!histMap.has(key)) {
        const p = products.find((p) => p.id === key);
        histMap.set(key, { sku: p?.sku ?? item.sku, name: p?.name ?? item.name, obs: [] });
      }
      histMap.get(key)!.obs.push({ date: po.created_at, cost: item.unit_cost });
    }
  }

  const trends = [...histMap.entries()]
    .map(([pid, data]) => {
      const sorted = [...data.obs].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].cost;
      const last = sorted[sorted.length - 1].cost;
      const changePct = first > 0 ? ((last - first) / first) * 100 : null;
      return { pid, sku: data.sku, name: data.name, obs: sorted, firstCost: first, lastCost: last, changePct };
    })
    .filter((t) => t.obs.length >= 2)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));

  // Overall YoY: compare costs from ≥12m ago vs recent
  const recentCosts: number[] = [];
  const olderCosts: number[] = [];
  for (const t of trends) {
    for (const obs of t.obs) {
      const age = now - new Date(obs.date).getTime();
      if (age <= twelveM) recentCosts.push(obs.cost);
      else olderCosts.push(obs.cost);
    }
  }
  const overallYoY =
    olderCosts.length > 0 && mean(olderCosts) > 0
      ? ((mean(recentCosts) - mean(olderCosts)) / mean(olderCosts)) * 100
      : null;

  if (trends.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">Cost trend</h3>
        <NoData msg="Need ≥2 received orders per product to compute cost trends." />
      </section>
    );
  }

  const insightText =
    overallYoY !== null && Math.abs(overallYoY) >= 1
      ? `This supplier has ${overallYoY > 0 ? "raised" : "lowered"} average unit costs by ${Math.abs(overallYoY).toFixed(1)}% over the tracked period.${overallYoY > 5 ? " Consider renegotiating or evaluating alternatives." : ""}`
      : null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">Cost trend</h3>

      {insightText && (
        <InsightBanner color={overallYoY! > 0 ? "amber" : "green"} text={insightText} />
      )}

      <div className="space-y-2">
        {trends.slice(0, 8).map((t) => {
          const minC = Math.min(...t.obs.map((o) => o.cost));
          const maxC = Math.max(...t.obs.map((o) => o.cost));
          const range = maxC - minC || 1;
          const W = 120;
          const H = 36;
          const color =
            (t.changePct ?? 0) > 0
              ? "#C54632"
              : (t.changePct ?? 0) < 0
              ? "#4D7B3D"
              : "#6B6B66";
          const pts = t.obs
            .map((o, i) => {
              const x =
                t.obs.length === 1 ? W / 2 : (i / (t.obs.length - 1)) * (W - 8) + 4;
              const y = H - 4 - ((o.cost - minC) / range) * (H - 10);
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <div
              key={t.pid}
              className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-500 text-[#1A1A17]">{t.sku}</p>
                <p className="text-[11px] text-[#6B6B66] truncate max-w-[200px]">{t.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] tabular-nums flex-wrap">
                  <span className="text-[#6B6B66]">
                    {formatCurrency(t.firstCost)} → {" "}
                    <span className="font-500" style={{ color }}>
                      {formatCurrency(t.lastCost)}
                    </span>
                  </span>
                  {t.changePct !== null && (
                    <span className="font-600" style={{ color }}>
                      ({t.changePct >= 0 ? "+" : ""}
                      {t.changePct.toFixed(1)}%)
                    </span>
                  )}
                  <span className="text-[#C8C8C4]">{t.obs.length} orders</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-[100px] shrink-0">
                {t.obs.length > 1 && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                  />
                )}
                {t.obs.map((o, i) => {
                  const x =
                    t.obs.length === 1 ? W / 2 : (i / (t.obs.length - 1)) * (W - 8) + 4;
                  const y = H - 4 - ((o.cost - minC) / range) * (H - 10);
                  return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
                })}
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Section 2: Lead Time Distribution ────────────────────────────────────────

function LeadTimeSection({
  pos,
  promisedLeadTime,
  economic,
}: {
  pos: SupplierPo[];
  promisedLeadTime: number;
  economic: SupplierEconomicData;
}) {
  const receivedPos = pos.filter((p) => p.status === "received" && p.received_at);
  const leadTimes = receivedPos.map((p) =>
    Math.round((new Date(p.received_at!).getTime() - new Date(p.created_at).getTime()) / 86400000)
  );

  if (leadTimes.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
          Lead time distribution
        </h3>
        <NoData msg="No received orders yet — lead time data unavailable." />
      </section>
    );
  }

  const avgLT = mean(leadTimes);
  const sdLT = stdDev(leadTimes);
  const ci95Low = Math.max(1, Math.round(avgLT - 1.65 * sdLT));
  const ci95High = Math.ceil(avgLT + 1.65 * sdLT);
  const cv = avgLT > 0 ? sdLT / avgLT : 0;

  const verdict: "Reliable" | "Variable" | "Unreliable" =
    cv < 0.2 && avgLT <= promisedLeadTime * 1.25
      ? "Reliable"
      : cv < 0.4 || avgLT <= promisedLeadTime * 1.5
      ? "Variable"
      : "Unreliable";

  const verdictStyle = {
    Reliable:   { bg: "bg-[#F2F8F0]", text: "text-[#4D7B3D]" },
    Variable:   { bg: "bg-[#FDF8EE]", text: "text-[#B47214]" },
    Unreliable: { bg: "bg-[#FDF2F0]", text: "text-[#C54632]" },
  }[verdict];

  const orgAvgLT =
    economic.orgLeadTimeDays.length > 0 ? mean(economic.orgLeadTimeDays) : null;

  // Build histogram buckets
  const maxLT = Math.max(...leadTimes, promisedLeadTime * 2);
  const bucketSize = maxLT <= 30 ? 5 : maxLT <= 60 ? 10 : 14;
  const numBuckets = Math.ceil(maxLT / bucketSize) + 1;
  const buckets: number[] = new Array(numBuckets).fill(0);
  for (const lt of leadTimes) {
    const b = Math.min(Math.floor(lt / bucketSize), numBuckets - 1);
    buckets[b]++;
  }
  const maxCount = Math.max(...buckets, 1);

  const W = 500;
  const H = 80;
  const barW = Math.floor((W / numBuckets) * 0.8);
  const gap = Math.floor((W / numBuckets) * 0.2);

  // Where the promised lead time falls on the chart
  const promisedX = (promisedLeadTime / bucketSize / numBuckets) * W;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Lead time distribution
      </h3>

      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-4">
        {/* Verdict + stats row */}
        <div className="flex items-center gap-4 flex-wrap">
          <span
            className={`text-xs font-600 px-2.5 py-1 rounded-full ${verdictStyle.bg} ${verdictStyle.text}`}
          >
            {verdict}
          </span>
          <div className="flex items-center gap-4 text-xs text-[#6B6B66] flex-wrap">
            <span>
              Avg:{" "}
              <span className="font-500 text-[#1A1A17] tabular-nums">{avgLT.toFixed(1)}d</span>
            </span>
            <span>
              Promised:{" "}
              <span className="font-500 text-[#1A1A17] tabular-nums">{promisedLeadTime}d</span>
            </span>
            <span>
              95% band:{" "}
              <span className="font-500 text-[#1A1A17] tabular-nums">
                {ci95Low}–{ci95High}d
              </span>
            </span>
            {orgAvgLT !== null && (
              <span>
                Org avg:{" "}
                <span className="font-500 text-[#1A1A17] tabular-nums">
                  {orgAvgLT.toFixed(1)}d
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Histogram */}
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
          {/* Promised lead time marker */}
          {promisedX < W && (
            <line
              x1={promisedX}
              y1={0}
              x2={promisedX}
              y2={H}
              stroke="#B47214"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
          {buckets.map((count, i) => {
            const x = i * (barW + gap) + gap / 2;
            const barH = count > 0 ? (count / maxCount) * (H - 4) : 0;
            const y = H - barH;
            const midDay = Math.round((i + 0.5) * bucketSize);
            const isLate = midDay > promisedLeadTime;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill={isLate ? "#C54632" : "#4D7B3D"}
                  fillOpacity={0.65}
                  rx={2}
                />
                <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="#6B6B66">
                  {i * bucketSize + 1}–{(i + 1) * bucketSize}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-[10px] text-[#C8C8C4]">
          Bars show number of orders at each lead time (days). Dashed line = promised {promisedLeadTime}d.
          Green = on/ahead of schedule. Red = overdue.
        </p>

        {/* Org comparison insight */}
        {orgAvgLT !== null && (
          <div className="pt-3 border-t border-[#E5E5E2]">
            {avgLT <= orgAvgLT ? (
              <InsightBanner
                color="green"
                text={`This supplier delivers in ${avgLT.toFixed(1)}d on average — ${(orgAvgLT - avgLT).toFixed(1)}d faster than the org-wide supplier average of ${orgAvgLT.toFixed(1)}d.`}
              />
            ) : (
              <InsightBanner
                color="amber"
                text={`This supplier averages ${avgLT.toFixed(1)}d — ${(avgLT - orgAvgLT).toFixed(1)}d slower than the org-wide average of ${orgAvgLT.toFixed(1)}d.${verdict === "Variable" || verdict === "Unreliable" ? " Ask for buffer stock commitments." : ""}`}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Section 3: Profit Unlocked ────────────────────────────────────────────────

function ProfitUnlockedSection({ products }: { products: SupplierProduct[] }) {
  const profit90d = products.reduce((s, p) => s + p.gross_profit_90d, 0);
  const revenue90d = products.reduce((s, p) => s + p.revenue_90d, 0);
  // Annualised estimate
  const profit12mEst = profit90d * (365 / 90);
  const revenue12mEst = revenue90d * (365 / 90);
  const topProducts = [...products]
    .filter((p) => p.gross_profit_90d > 0)
    .sort((a, b) => b.gross_profit_90d - a.gross_profit_90d)
    .slice(0, 3);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Profit unlocked
      </h3>

      <InsightBanner
        color={profit12mEst > 10000 ? "green" : profit12mEst > 1000 ? "amber" : "red"}
        text={`This supplier enables ${formatCurrency(profit12mEst)} in estimated annual profit (${formatCurrency(profit90d)} in the last 90 days). If you lost them tomorrow, that's the exposure.`}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-1">
          <p className="text-xs text-[#6B6B66]">Gross profit (90d)</p>
          <p
            className="text-2xl font-600 tabular-nums"
            style={{ color: profit90d > 0 ? "#1A1A17" : "#C54632" }}
          >
            {formatCurrency(profit90d)}
          </p>
          <p className="text-xs text-[#6B6B66]">on {formatCurrency(revenue90d)} revenue</p>
        </div>
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-1">
          <p className="text-xs text-[#6B6B66]">Annualised estimate</p>
          <p
            className="text-2xl font-600 tabular-nums"
            style={{ color: profit12mEst > 0 ? "#1A1A17" : "#C54632" }}
          >
            {formatCurrency(profit12mEst)}
          </p>
          <p className="text-xs text-[#6B6B66]">on ~{formatCurrency(revenue12mEst)} revenue</p>
        </div>
      </div>

      {topProducts.length > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-3">
            Top profit drivers (90d)
          </p>
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const share = profit90d > 0 ? p.gross_profit_90d / profit90d : 0;
              const color =
                p.gross_margin_pct >= 0.25
                  ? "#4D7B3D"
                  : p.gross_margin_pct >= 0.15
                  ? "#B47214"
                  : "#C54632";
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#C8C8C4] tabular-nums w-4">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-500 text-[#1A1A17]">
                        {p.sku}{" "}
                        <span className="font-400 text-[#6B6B66]">{p.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs font-600 tabular-nums" style={{ color }}>
                          {(p.gross_margin_pct * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-[#6B6B66] tabular-nums">
                          {formatCurrency(p.gross_profit_90d)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-[#F0F0EE] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(share * 100)}%`, background: color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Section 4: Concentration Risk ────────────────────────────────────────────

function ConcentrationRiskSection({
  products,
  economic,
}: {
  products: SupplierProduct[];
  economic: SupplierEconomicData;
}) {
  const supplierRevenue90d = products.reduce((s, p) => s + p.revenue_90d, 0);
  const revSharePct =
    economic.orgRevenue90d > 0
      ? (supplierRevenue90d / economic.orgRevenue90d) * 100
      : null;

  const supplierAbcA = products.filter((p) => p.abc_class === "A").length;
  const abcASharePct =
    economic.orgAbcACount > 0 ? (supplierAbcA / economic.orgAbcACount) * 100 : null;

  const riskScore: "Low" | "Medium" | "High" =
    (revSharePct !== null && revSharePct > 50) ||
    (abcASharePct !== null && abcASharePct > 40)
      ? "High"
      : (revSharePct !== null && revSharePct > 25) ||
        (abcASharePct !== null && abcASharePct > 20)
      ? "Medium"
      : "Low";

  const riskStyle = {
    Low:    { bg: "bg-[#F2F8F0]", text: "text-[#4D7B3D]", banner: "green" as const },
    Medium: { bg: "bg-[#FDF8EE]", text: "text-[#B47214]", banner: "amber" as const },
    High:   { bg: "bg-[#FDF2F0]", text: "text-[#C54632]", banner: "red"   as const },
  }[riskScore];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Concentration risk
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-1 col-span-2">
          <p className="text-xs text-[#6B6B66]">Revenue dependent on this supplier</p>
          <p className="text-2xl font-600 tabular-nums text-[#1A1A17]">
            {revSharePct !== null ? `${revSharePct.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-[#6B6B66]">
            {formatCurrency(supplierRevenue90d)} of{" "}
            {formatCurrency(economic.orgRevenue90d)} total (90d)
          </p>
          {revSharePct !== null && (
            <div className="mt-2 h-1.5 bg-[#F0F0EE] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, revSharePct).toFixed(0)}%`,
                  background: revSharePct > 50 ? "#C54632" : revSharePct > 25 ? "#B47214" : "#4D7B3D",
                }}
              />
            </div>
          )}
        </div>

        <div
          className={`rounded-lg p-4 flex flex-col items-center justify-center ${riskStyle.bg} border border-current/10`}
        >
          <p className="text-[10px] font-600 text-[#6B6B66] uppercase tracking-wider mb-1">
            Risk score
          </p>
          <p className={`text-2xl font-700 ${riskStyle.text}`}>{riskScore}</p>
        </div>
      </div>

      {economic.orgAbcACount > 0 && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6B6B66]">Class A products from this supplier</p>
            <p className="text-xs text-[#C8C8C4] mt-0.5">
              {supplierAbcA} of {economic.orgAbcACount} class A SKUs in org
            </p>
          </div>
          <p
            className="text-lg font-600 tabular-nums"
            style={{
              color:
                (abcASharePct ?? 0) > 40
                  ? "#C54632"
                  : (abcASharePct ?? 0) > 20
                  ? "#B47214"
                  : "#4D7B3D",
            }}
          >
            {abcASharePct !== null ? `${abcASharePct.toFixed(0)}%` : "—"}
          </p>
        </div>
      )}

      {riskScore !== "Low" && (
        <InsightBanner
          color={riskStyle.banner}
          text={
            riskScore === "High"
              ? `High dependency — ${revSharePct?.toFixed(1)}% of revenue flows through this single supplier. Build a contingency plan or qualify a backup.`
              : `Moderate dependency on this supplier. Consider qualifying a secondary source for your highest-revenue SKUs.`
          }
        />
      )}
    </section>
  );
}

// ── Section 5: Negotiation Leverage ──────────────────────────────────────────

function NegotiationLeverageSection({
  pos,
  products,
  economic,
  promisedLeadTime,
}: {
  pos: SupplierPo[];
  products: SupplierProduct[];
  economic: SupplierEconomicData;
  promisedLeadTime: number;
}) {
  const spendSharePct =
    economic.orgTotalPoSpend12m > 0
      ? (economic.supplierPoSpend12m / economic.orgTotalPoSpend12m) * 100
      : null;

  // Derive signals for talking points
  const receivedPos = pos.filter((p) => p.status === "received" && p.received_at);
  const leadTimes = receivedPos.map((p) =>
    Math.round((new Date(p.received_at!).getTime() - new Date(p.created_at).getTime()) / 86400000)
  );
  const avgLT = mean(leadTimes);
  const sdLT = stdDev(leadTimes);
  const cv = avgLT > 0 ? sdLT / avgLT : 0;
  const isSlowOnLeadTime = avgLT > promisedLeadTime * 1.2;
  const isVariableLeadTime = cv >= 0.3;

  // Cost trend signal
  const hasRisingCosts = (() => {
    const now = Date.now();
    const cutoff = now - 180 * 86400000;
    const recent: number[] = [];
    const older: number[] = [];
    for (const po of pos) {
      if (po.status !== "received") continue;
      const poAge = now - new Date(po.created_at).getTime();
      for (const item of po.items) {
        if (item.unit_cost <= 0) continue;
        if (poAge <= cutoff) recent.push(item.unit_cost);
        else older.push(item.unit_cost);
      }
    }
    if (older.length === 0 || recent.length === 0) return false;
    return mean(recent) > mean(older) * 1.03;
  })();

  const isSignificantCustomer = spendSharePct !== null && spendSharePct >= 25;
  const isHighSpend = economic.supplierPoSpend12m > 50000;

  const points: Array<{ icon: string; title: string; detail: string }> = [];

  if (isSlowOnLeadTime || isVariableLeadTime) {
    points.push({
      icon: "⏱",
      title: "Request buffer stock or consignment",
      detail: `Average lead time is ${avgLT.toFixed(0)}d${isVariableLeadTime ? ` with high variance (CV ${(cv * 100).toFixed(0)}%)` : ""} — ask them to hold safety stock at your call-off.`,
    });
  }

  if (hasRisingCosts) {
    points.push({
      icon: "📉",
      title: "Push for a volume discount",
      detail: `Unit costs have risen in the last 6 months. Bring historical cost data to the conversation and ask for a tiered rebate tied to annual spend.`,
    });
  }

  if (isSignificantCustomer || isHighSpend) {
    points.push({
      icon: "💳",
      title: "Negotiate extended payment terms",
      detail: `You represent ${spendSharePct?.toFixed(1) ?? "a significant"}% of your own procurement from this supplier${isHighSpend ? ` (${formatCurrency(economic.supplierPoSpend12m)} in 12m)` : ""}. Use that to ask for Net-60 or Net-90 terms.`,
    });
  }

  if (products.some((p) => p.inventory_turnover > 6)) {
    points.push({
      icon: "🔄",
      title: "Cite high turnover as volume guarantee",
      detail: "Some of their products turn 6× or faster. Guaranteed volume is valuable — use it to ask for cost reductions or priority allocation.",
    });
  }

  if (points.length === 0) {
    points.push({
      icon: "📋",
      title: "Build a relationship baseline",
      detail: "Not enough history to identify specific leverage points. After 3+ orders, stronger negotiation signals will appear here.",
    });
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
        Negotiation leverage
      </h3>

      {/* Spend share */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6B6B66]">Share of your total procurement spend</p>
          <p className="text-xs text-[#C8C8C4] mt-0.5">
            {formatCurrency(economic.supplierPoSpend12m)} of{" "}
            {formatCurrency(economic.orgTotalPoSpend12m)} (last 12m, received orders)
          </p>
        </div>
        <p
          className="text-2xl font-600 tabular-nums shrink-0 ml-4"
          style={{
            color:
              spendSharePct === null
                ? "#6B6B66"
                : spendSharePct > 40
                ? "#C54632"
                : spendSharePct > 20
                ? "#B47214"
                : "#1A1A17",
          }}
        >
          {spendSharePct !== null ? `${spendSharePct.toFixed(1)}%` : "—"}
        </p>
      </div>

      {/* Talking points */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
          Suggested talking points
        </p>
        <div className="space-y-3">
          {points.map((pt, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-base shrink-0 mt-0.5">{pt.icon}</span>
              <div>
                <p className="text-sm font-500 text-[#1A1A17]">{pt.title}</p>
                <p className="text-xs text-[#6B6B66] mt-0.5">{pt.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SupplierEconomicAnalysis({ pos, products, economic, promisedLeadTime }: Props) {
  return (
    <div className="space-y-8">
      <CostTrendSection pos={pos} products={products} />
      <LeadTimeSection pos={pos} promisedLeadTime={promisedLeadTime} economic={economic} />
      <ProfitUnlockedSection products={products} />
      <ConcentrationRiskSection products={products} economic={economic} />
      <NegotiationLeverageSection
        pos={pos}
        products={products}
        economic={economic}
        promisedLeadTime={promisedLeadTime}
      />
    </div>
  );
}

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

// ── Public data shape ─────────────────────────────────────────────────────────

export interface AnalyticsData {
  elasticity: {
    elasticity: number;
    classification: "inelastic" | "unit_elastic" | "elastic" | "highly_elastic" | "unknown";
    confidence: number;
    data_points: number;
    distinct_prices: number;
    recommended_price: number;
    expected_units_at_recommended: number;
    expected_profit_at_recommended: number;
    baseline_profit: number;
    unit_cost: number;
    current_price: number;
    insight: string;
    observations: Array<{ price: number; qty: number }>;
  } | null;

  perUnit: {
    revenue: number;
    cogs: number;
    avgDiscount: number;
    platformFee: number;
    grossProfit: number;
    realMarginPct: number;
  };
  categoryAvgMarginPct: number | null;

  stockoutDays90: number;
  estimatedLostProfit: number;
  isCurrentlyStockedOut: boolean;
  avgDailySales: number;

  topCustomers90d: Array<{ id: string | null; name: string; revenue: number; qty: number }>;
  totalRevenue90d: number;

  coPurchase: Array<{ product_id: string; sku: string; name: string; co_count: number }>;
}

// ── Classification metadata ───────────────────────────────────────────────────

const CLS_META: Record<
  "inelastic" | "unit_elastic" | "elastic" | "highly_elastic" | "unknown",
  { label: string; color: string; bg: string }
> = {
  inelastic: { label: "Inelastic", color: "#4D7B3D", bg: "#F2F8F0" },
  unit_elastic: { label: "Unit elastic", color: "#B47214", bg: "#FDF8EE" },
  elastic: { label: "Elastic", color: "#B47214", bg: "#FDF8EE" },
  highly_elastic: { label: "Highly elastic", color: "#C54632", bg: "#FDF2F0" },
  unknown: { label: "Unknown", color: "#6B6B66", bg: "#F7F7F5" },
};

// ── Root component ────────────────────────────────────────────────────────────

export function ProductAnalyticsTab({
  data,
  onApplyPrice,
}: {
  data: AnalyticsData;
  onApplyPrice: (price: number) => Promise<void>;
}) {
  return (
    <div className="p-4 space-y-7">
      <ElasticitySection data={data} onApplyPrice={onApplyPrice} />
      <ProfitAttributionSection data={data} />
      <StockoutSection data={data} />
      <CustomerConcentrationSection data={data} />
      <CoPurchaseSection data={data} />
    </div>
  );
}

// ── Section 1: Elasticity ─────────────────────────────────────────────────────

function ElasticitySection({
  data,
  onApplyPrice,
}: {
  data: AnalyticsData;
  onApplyPrice: (price: number) => Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const e = data.elasticity;

  async function handleApply() {
    if (!e) return;
    setApplying(true);
    try {
      await onApplyPrice(e.recommended_price);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }

  const cls = e ? CLS_META[e.classification] : null;
  const hasUsableData = e && e.classification !== "unknown";

  return (
    <div>
      <SectionHeader
        title="Price elasticity"
        description="How sensitive are customers to price changes for this SKU?"
      />
      {!hasUsableData ? (
        <EmptyState
          message={
            e
              ? `Insufficient price variation to model elasticity. Need 20+ distinct price points — found ${e.distinct_prices}.`
              : "No sales data available."
          }
        />
      ) : (
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: stats + recommended price */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-600 tabular-nums text-[#1A1A17]">
                  ε = {e.elasticity.toFixed(3)}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded font-500"
                  style={{ color: cls!.color, background: cls!.bg }}
                >
                  {cls!.label}
                </span>
              </div>

              <ConfidenceBar confidence={e.confidence} dataPoints={e.data_points} />

              <div className="border border-[#E5E5E2] rounded-lg p-3 space-y-2">
                <p className="text-xs text-[#6B6B66]">Profit-maximising price</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-600 tabular-nums text-[#1A1A17]">
                    {formatCurrency(e.recommended_price)}
                  </p>
                  <p className="text-xs text-[#6B6B66]">
                    ({e.recommended_price > e.current_price ? "+" : ""}
                    {(
                      ((e.recommended_price - e.current_price) / Math.max(e.current_price, 0.01)) *
                      100
                    ).toFixed(1)}
                    % from {formatCurrency(e.current_price)})
                  </p>
                </div>
                <p className="text-xs text-[#6B6B66]">
                  {e.expected_units_at_recommended} units/day expected · profit lift{" "}
                  {formatCurrency(
                    Math.max(0, (e.expected_profit_at_recommended - e.baseline_profit) * 30)
                  )}
                  /month
                </p>
                {!applied ? (
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="text-xs px-3 py-1.5 bg-[#1A1A17] text-white rounded hover:bg-[#2D2D2A] disabled:opacity-50 transition-colors"
                  >
                    {applying ? "Applying…" : "Apply recommended price"}
                  </button>
                ) : (
                  <p className="text-xs text-[#4D7B3D] font-500">
                    ✓ Price updated — re-run elasticity model to refresh
                  </p>
                )}
              </div>

              <p className="text-xs text-[#6B6B66] leading-relaxed">{e.insight}</p>
            </div>

            {/* Right: mini scatter plot */}
            <div>
              <p className="text-xs text-[#6B6B66] mb-2">
                Price vs. units sold (daily observations)
              </p>
              <ElasticityScatter
                observations={e.observations}
                currentPrice={e.current_price}
                recommendedPrice={e.recommended_price}
              />
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-[#6B6B66]">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-5"
                    style={{
                      borderTop: "1.5px dashed #B47214",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                  />
                  Current (${e.current_price.toFixed(0)})
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-5"
                    style={{
                      borderTop: "1.5px dashed #4D7B3D",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                  />
                  Recommended (${e.recommended_price.toFixed(0)})
                </span>
              </div>
              <p className="text-[10px] text-[#9B9B96] mt-1">
                {e.data_points} observations · R² {(e.confidence * 100).toFixed(0)}% ·{" "}
                {e.distinct_prices} distinct prices
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ElasticityScatter({
  observations,
  currentPrice,
  recommendedPrice,
}: {
  observations: Array<{ price: number; qty: number }>;
  currentPrice: number;
  recommendedPrice: number;
}) {
  const W = 230;
  const H = 116;
  const PAD = { t: 6, r: 8, b: 20, l: 32 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  if (observations.length === 0) return null;

  const prices = observations.map((o) => o.price);
  const qtys = observations.map((o) => o.qty);
  const minP = Math.min(...prices, currentPrice, recommendedPrice);
  const maxP = Math.max(...prices, currentPrice, recommendedPrice);
  const maxQ = Math.max(...qtys, 1);
  const rangeP = maxP - minP || 1;

  const sx = (p: number) => PAD.l + ((p - minP) / rangeP) * plotW;
  const sy = (q: number) => PAD.t + plotH - (q / maxQ) * plotH;

  const curX = sx(currentPrice);
  const recX = sx(recommendedPrice);

  const sample =
    observations.length > 150 ? observations.slice(-150) : observations;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block" }}
    >
      <line
        x1={PAD.l}
        y1={PAD.t}
        x2={PAD.l}
        y2={PAD.t + plotH}
        stroke="#E5E5E2"
        strokeWidth={1}
      />
      <line
        x1={PAD.l}
        y1={PAD.t + plotH}
        x2={PAD.l + plotW}
        y2={PAD.t + plotH}
        stroke="#E5E5E2"
        strokeWidth={1}
      />
      {sample.map((o, i) => (
        <circle
          key={i}
          cx={sx(o.price)}
          cy={sy(o.qty)}
          r={2.5}
          fill="#1A1A17"
          fillOpacity={0.3}
        />
      ))}
      <line
        x1={curX}
        y1={PAD.t}
        x2={curX}
        y2={PAD.t + plotH}
        stroke="#B47214"
        strokeWidth={1.5}
        strokeDasharray="3,2"
      />
      <line
        x1={recX}
        y1={PAD.t}
        x2={recX}
        y2={PAD.t + plotH}
        stroke="#4D7B3D"
        strokeWidth={1.5}
        strokeDasharray="3,2"
      />
      <text
        x={PAD.l}
        y={H - 4}
        fontSize={8}
        fill="#9B9B96"
        textAnchor="start"
      >
        ${minP.toFixed(0)}
      </text>
      <text
        x={W - PAD.r}
        y={H - 4}
        fontSize={8}
        fill="#9B9B96"
        textAnchor="end"
      >
        ${maxP.toFixed(0)}
      </text>
      <text
        x={PAD.l + plotW / 2}
        y={H - 4}
        fontSize={8}
        fill="#9B9B96"
        textAnchor="middle"
      >
        price →
      </text>
      <text
        fontSize={8}
        fill="#9B9B96"
        textAnchor="middle"
        transform={`rotate(-90, 10, ${PAD.t + plotH / 2})`}
        x={10}
        y={PAD.t + plotH / 2}
      >
        qty
      </text>
      <text
        x={PAD.l + 2}
        y={PAD.t + plotH - 2}
        fontSize={7}
        fill="#9B9B96"
        textAnchor="start"
      >
        0
      </text>
      <text
        x={PAD.l + 2}
        y={PAD.t + 6}
        fontSize={7}
        fill="#9B9B96"
        textAnchor="start"
      >
        {maxQ}
      </text>
    </svg>
  );
}

// ── Section 2: Profit attribution ─────────────────────────────────────────────

function ProfitAttributionSection({ data }: { data: AnalyticsData }) {
  const { revenue, cogs, avgDiscount, platformFee, grossProfit, realMarginPct } =
    data.perUnit;

  type Segment = { label: string; value: number; pct: number; color: string };
  const segments: Segment[] = [
    {
      label: "COGS",
      value: cogs,
      pct: revenue > 0 ? cogs / revenue : 0,
      color: "#9B9B96",
    },
    ...(avgDiscount > 0.005
      ? [
          {
            label: "Avg discount",
            value: avgDiscount,
            pct: avgDiscount / revenue,
            color: "#B47214",
          } as Segment,
        ]
      : []),
    ...(platformFee > 0.005
      ? [
          {
            label: "Platform fee",
            value: platformFee,
            pct: platformFee / revenue,
            color: "#6B6B66",
          } as Segment,
        ]
      : []),
    {
      label: "Gross profit",
      value: Math.max(0, grossProfit),
      pct: revenue > 0 ? Math.max(0, grossProfit) / revenue : 0,
      color: "#4D7B3D",
    },
  ];

  const marginDiff =
    data.categoryAvgMarginPct !== null
      ? realMarginPct - data.categoryAvgMarginPct
      : null;

  return (
    <div>
      <SectionHeader
        title="Profit attribution"
        description="How is this product's profit distributed per unit sold?"
      />
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-3">
        {/* Stacked bar */}
        <div className="flex h-7 rounded overflow-hidden border border-[#E5E5E2]">
          {segments.map((seg) => (
            <div
              key={seg.label}
              style={{
                width: `${Math.max(seg.pct * 100, 0)}%`,
                background: seg.color,
                minWidth: seg.value > 0 ? 2 : 0,
              }}
              title={`${seg.label}: ${formatCurrency(seg.value)} (${(seg.pct * 100).toFixed(1)}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: seg.color }}
              />
              <span className="text-[#6B6B66]">{seg.label}</span>
              <span className="font-500 tabular-nums text-[#1A1A17]">
                {formatCurrency(seg.value)}
              </span>
              <span className="text-[#9B9B96]">
                ({(seg.pct * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div className="pt-2 border-t border-[#E5E5E2] flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#6B6B66]">
            Revenue/unit{" "}
            <span className="text-[#1A1A17] font-500">{formatCurrency(revenue)}</span>
            {"  ·  "}Gross margin{" "}
            <span
              className="font-500"
              style={{
                color:
                  realMarginPct >= 0.25
                    ? "#4D7B3D"
                    : realMarginPct >= 0.15
                    ? "#B47214"
                    : "#C54632",
              }}
            >
              {(realMarginPct * 100).toFixed(1)}%
            </span>
          </p>
          {marginDiff !== null && (
            <p className="text-xs text-[#6B6B66]">
              Category avg{" "}
              <span className="font-500">
                {(data.categoryAvgMarginPct! * 100).toFixed(1)}%
              </span>{" "}
              <span
                className="text-[10px]"
                style={{ color: marginDiff >= 0 ? "#4D7B3D" : "#C54632" }}
              >
                ({marginDiff >= 0 ? "+" : ""}
                {(marginDiff * 100).toFixed(1)}pp)
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section 3: Stockout cost ──────────────────────────────────────────────────

function StockoutSection({ data }: { data: AnalyticsData }) {
  const { stockoutDays90, estimatedLostProfit, isCurrentlyStockedOut, avgDailySales } = data;

  return (
    <div>
      <SectionHeader
        title="Stockout cost — last 90 days"
        description="Estimated profit lost to out-of-stock periods, based on average daily sales rate."
      />
      {stockoutDays90 === 0 && !isCurrentlyStockedOut ? (
        <div className="bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded-lg px-4 py-3">
          <p className="text-sm font-500 text-[#4D7B3D]">No significant stockouts detected</p>
          <p className="text-xs text-[#6B6B66] mt-0.5">
            This product has maintained stock availability over the last 90 days.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#6B6B66]">Days out of stock (90d)</p>
              <p
                className="text-2xl font-600 tabular-nums mt-1"
                style={{ color: stockoutDays90 > 14 ? "#C54632" : "#B47214" }}
              >
                {stockoutDays90}d
              </p>
              {isCurrentlyStockedOut && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#FDF2F0] text-[#C54632] rounded font-500">
                  Currently stocked out
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-[#6B6B66]">Est. lost profit</p>
              <p className="text-2xl font-600 tabular-nums mt-1 text-[#C54632]">
                {formatCurrency(estimatedLostProfit)}
              </p>
              <p className="text-xs text-[#9B9B96]">
                at {avgDailySales.toFixed(1)} units/day avg
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B6B66]">Recommendation</p>
              <p className="text-sm font-500 text-[#1A1A17] mt-1 leading-snug">
                {stockoutDays90 > 30
                  ? "Increase reorder point significantly — chronic stockouts are eroding profit"
                  : stockoutDays90 > 7
                  ? "Review reorder point and add lead time buffer to prevent recurrence"
                  : "Minor stockout — monitor reorder trigger closely"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section 4: Customer concentration ────────────────────────────────────────

function CustomerConcentrationSection({ data }: { data: AnalyticsData }) {
  const { topCustomers90d, totalRevenue90d } = data;

  if (topCustomers90d.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Customer concentration"
          description="Which customers drive revenue for this SKU? (last 90 days)"
        />
        <EmptyState message="No completed sales in the last 90 days." />
      </div>
    );
  }

  const top = topCustomers90d[0];
  const topPct = totalRevenue90d > 0 ? top.revenue / totalRevenue90d : 0;
  const top3Revenue = topCustomers90d
    .slice(0, 3)
    .reduce((s, c) => s + c.revenue, 0);
  const top3Pct = totalRevenue90d > 0 ? top3Revenue / totalRevenue90d : 0;

  return (
    <div>
      <SectionHeader
        title="Customer concentration"
        description="Which customers drive revenue for this SKU? (last 90 days)"
      />
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        {topPct > 0.5 && (
          <div className="px-4 py-3 bg-[#FDF8EE] border-b border-[#B47214]/20">
            <p className="text-sm font-500 text-[#B47214]">
              High concentration risk — {(topPct * 100).toFixed(0)}% of this SKU's revenue is
              from one customer
            </p>
            <p className="text-xs text-[#6B6B66] mt-0.5">
              If {top.name} stops ordering, you lose ~{formatCurrency(top.revenue)}/90d from
              this product alone.
            </p>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Customer
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Units
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Revenue
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                % of SKU
              </th>
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {topCustomers90d.map((c) => {
              const pct = totalRevenue90d > 0 ? c.revenue / totalRevenue90d : 0;
              return (
                <tr key={c.id ?? c.name} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5 text-xs">
                    {c.id && c.id !== "guest" ? (
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-[#1A1A17] font-500 hover:underline"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className="text-[#6B6B66]">{c.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#6B6B66]">
                    {c.qty}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums font-500 text-[#1A1A17]">
                    {formatCurrency(c.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#6B6B66]">
                    {(pct * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 bg-[#F0F0EE] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#1A1A17] rounded"
                        style={{ width: `${Math.min(pct * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {topCustomers90d.length >= 3 && (
          <div className="px-4 py-2 border-t border-[#E5E5E2] bg-[#F7F7F5]">
            <p className="text-[11px] text-[#9B9B96]">
              Top 3 = {(top3Pct * 100).toFixed(0)}% of revenue ·{" "}
              Total 90d: {formatCurrency(totalRevenue90d)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 5: Co-purchase ────────────────────────────────────────────────────

function CoPurchaseSection({ data }: { data: AnalyticsData }) {
  if (data.coPurchase.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Frequently bought together"
          description="Products often purchased in the same order — useful for bundling and cross-sell."
        />
        <EmptyState message="No co-purchase data. Requires 10+ completed orders to detect patterns." />
      </div>
    );
  }

  const maxCount = Math.max(...data.coPurchase.map((c) => c.co_count), 1);

  return (
    <div>
      <SectionHeader
        title="Frequently bought together"
        description="Products often purchased in the same order — useful for bundling and cross-sell."
      />
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <div className="divide-y divide-[#E5E5E2]">
          {data.coPurchase.map((co, i) => {
            const strength = co.co_count / maxCount;
            return (
              <div key={co.product_id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#F7F7F5]">
                <span className="text-[10px] text-[#C8C8C4] w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${co.product_id}`}
                    className="text-xs font-500 text-[#1A1A17] hover:underline block truncate"
                  >
                    {co.sku} — {co.name}
                  </Link>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 h-1.5 bg-[#F0F0EE] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#1A1A17] rounded"
                      style={{ width: `${strength * 100}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-[#6B6B66] w-16 text-right">
                    {co.co_count} order{co.co_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[#E5E5E2] bg-[#F7F7F5]">
          <p className="text-[11px] text-[#9B9B96]">
            Count = completed orders containing both this SKU and the listed product. Consider bundling
            the top pairs.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-2.5">
      <h3 className="text-sm font-600 text-[#1A1A17]">{title}</h3>
      <p className="text-xs text-[#6B6B66] mt-0.5">{description}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-[#F7F7F5] border border-[#E5E5E2] rounded-lg px-4 py-6 text-center">
      <p className="text-xs text-[#6B6B66]">{message}</p>
    </div>
  );
}

function ConfidenceBar({
  confidence,
  dataPoints,
}: {
  confidence: number;
  dataPoints: number;
}) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 60 ? "#4D7B3D" : pct >= 40 ? "#B47214" : "#C54632";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#6B6B66]">Model confidence (R²)</span>
        <span className="text-xs tabular-nums font-600" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-[#F0F0EE] rounded overflow-hidden">
        <div
          className="h-full rounded transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-[10px] text-[#9B9B96] mt-0.5">{dataPoints} observations</p>
    </div>
  );
}

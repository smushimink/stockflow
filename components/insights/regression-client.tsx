"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type {
  SalesDriversResult,
  ClvPredictorResult,
  LeadTimeModelResult,
  RegressionCoefficient,
} from "@/lib/analytics/regression-models";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  salesResult: SalesDriversResult;
  clvResult: ClvPredictorResult;
  leadTimeResult: LeadTimeModelResult;
  periodDays: number;
  categoryFilter: string;
  categories: string[];
}

type Tab = "sales" | "clv" | "leadtime";

const PERIOD_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 180 days" },
];

const VAR_LABELS: Record<string, string> = {
  intercept: "Intercept",
  "discount_%": "Discount %",
  is_weekend: "Weekend",
  month: "Month",
  price: "Price ($)",
  monthly_revenue_rate: "Monthly revenue rate",
  order_frequency: "Order frequency",
  avg_interval_days: "Avg interval (days)",
};

// ── Main component ────────────────────────────────────────────────────────────

export function RegressionClient({
  salesResult,
  clvResult,
  leadTimeResult,
  periodDays,
  categoryFilter,
  categories,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("sales");
  const [localPeriod, setLocalPeriod] = useState(String(periodDays));
  const [localCategory, setLocalCategory] = useState(categoryFilter);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRunSalesAnalysis() {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("period", localPeriod);
      if (localCategory && localCategory !== "all") {
        params.set("category", localCategory);
      }
      router.push(`/insights/regression?${params.toString()}`);
    });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "sales", label: "Sales drivers" },
    { id: "clv", label: "Customer CLV" },
    { id: "leadtime", label: "Lead time" },
  ];

  return (
    <div className="space-y-5">
      {/* Inner model tab bar */}
      <div className="flex gap-0 border-b border-[#E5E5E2]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-[#1A1A17] text-[#1A1A17] font-500"
                : "border-transparent text-[#6B6B66] hover:text-[#1A1A17]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sales" && (
        <SalesDriversPanel
          result={salesResult}
          period={localPeriod}
          category={localCategory}
          categories={categories}
          onPeriodChange={setLocalPeriod}
          onCategoryChange={setLocalCategory}
          onRun={handleRunSalesAnalysis}
          isPending={isPending}
        />
      )}

      {activeTab === "clv" && <ClvPanel result={clvResult} />}

      {activeTab === "leadtime" && <LeadTimePanel result={leadTimeResult} />}
    </div>
  );
}

// ── Sales Drivers Panel ───────────────────────────────────────────────────────

function SalesDriversPanel({
  result,
  period,
  category,
  categories,
  onPeriodChange,
  onCategoryChange,
  onRun,
  isPending,
}: {
  result: SalesDriversResult;
  period: string;
  category: string;
  categories: string[];
  onPeriodChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onRun: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[#6B6B66]">
          OLS regression on individual sales line items. Features: discount %, day-of-week, month,
          and net price. Every coefficient, standard error, and p-value is shown — you can audit
          every number.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="h-8 text-sm border border-[#E5E5E2] rounded px-2 bg-white text-[#1A1A17]"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-8 text-sm border border-[#E5E5E2] rounded px-2 bg-white text-[#1A1A17]"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <button
          onClick={onRun}
          disabled={isPending}
          className="h-8 px-4 text-sm bg-[#1A1A17] text-white rounded hover:bg-[#2D2D2A] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Running…" : "Run analysis"}
        </button>

        {!result.insufficient_data && (
          <span className="text-xs text-[#6B6B66]">
            {result.observations} obs ·{" "}
            <code className="font-mono text-[11px] bg-[#F7F7F5] px-1 py-0.5 rounded">
              {result.formula}
            </code>
          </span>
        )}
      </div>

      {result.insufficient_data ? (
        <InsufficientData message={result.message} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <R2Badge r2={result.r_squared} />
          </div>

          {result.insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Top insights
              </p>
              {result.insights.map((insight, i) => (
                <InsightCard key={i} text={insight} />
              ))}
            </div>
          )}

          <CoeffTable coefficients={result.coefficients} />
        </>
      )}
    </div>
  );
}

// ── CLV Panel ─────────────────────────────────────────────────────────────────

function ClvPanel({ result }: { result: ClvPredictorResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B6B66]">
        OLS regression predicting customer lifetime value from purchase behaviour. Only customers
        with 2+ completed orders are included. Segments are defined by order frequency (±1 std dev
        from mean).
      </p>

      {result.insufficient_data ? (
        <InsufficientData message={result.message} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <R2Badge r2={result.r_squared} />
            <span className="text-xs text-[#6B6B66]">
              Features: {result.features_used.map((f) => VAR_LABELS[f] ?? f).join(", ")}
            </span>
          </div>

          {/* Frequency segments */}
          {result.segment_avg_clv.length > 0 && (
            <div>
              <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">
                Average CLV by order frequency
              </p>
              <div className="grid grid-cols-3 gap-3">
                {result.segment_avg_clv.map((seg, i) => {
                  const colors = [
                    "border-[#9B9B96]/30 text-[#6B6B66]",
                    "border-[#B47214]/30 text-[#B47214]",
                    "border-[#4D7B3D]/30 text-[#4D7B3D]",
                  ];
                  return (
                    <div
                      key={seg.segment}
                      className={cn(
                        "bg-white border rounded-lg p-4",
                        colors[i] ?? "border-[#E5E5E2]"
                      )}
                    >
                      <p className="text-xs font-600 uppercase tracking-wider opacity-80">
                        {seg.segment}
                      </p>
                      <p className="text-2xl font-600 tabular-nums mt-2 text-[#1A1A17]">
                        ${seg.avg_clv.toLocaleString()}
                      </p>
                      <p className="text-xs text-[#6B6B66] mt-1">{seg.n} customers</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.insights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Top insights
              </p>
              {result.insights.map((insight, i) => (
                <InsightCard key={i} text={insight} />
              ))}
            </div>
          )}

          <CoeffTable coefficients={result.coefficients} />
        </>
      )}
    </div>
  );
}

// ── Lead Time Panel ───────────────────────────────────────────────────────────

function LeadTimePanel({ result }: { result: LeadTimeModelResult }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B6B66]">
        Per-supplier lead-time distribution computed from received purchase orders. Shows actual
        avg vs promised, variability (σ), 95% confidence band (mean ± 2σ), and planning lead
        time recommendation (mean + 1.65σ — the 95th-percentile safe buffer).
      </p>

      {result.insufficient_data ? (
        <InsufficientData message={result.message} />
      ) : (
        <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
                <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Supplier
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Promised
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Actual avg
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Variability σ
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  95% band
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Plan with
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  n
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2]">
              {result.by_supplier.map((sup) => {
                const bias = sup.actual_avg - sup.promised_lead_time;
                // 95th-percentile safe planning buffer
                const planningLead = Math.ceil(sup.actual_avg + 1.65 * sup.variability);
                const isLate = bias > 2;
                const isVariable = sup.variability > 5;
                const verdict = isLate ? "Unreliable" : isVariable ? "Variable" : "Reliable";
                const verdictStyle = isLate
                  ? "bg-[#FDF2F0] text-[#C54632]"
                  : isVariable
                  ? "bg-[#FDF8EE] text-[#B47214]"
                  : "bg-[#F2F8F0] text-[#4D7B3D]";

                return (
                  <tr key={sup.supplier_id} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-xs font-500 text-[#1A1A17]">{sup.supplier_name}</p>
                      <p
                        className="text-[11px] text-[#6B6B66] mt-0.5 truncate"
                        title={sup.insight}
                      >
                        {sup.insight}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#6B6B66]">
                      {sup.promised_lead_time}d
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      <span
                        className={cn(
                          "font-500",
                          isLate ? "text-[#C54632]" : "text-[#1A1A17]"
                        )}
                      >
                        {sup.actual_avg}d
                      </span>
                      {Math.abs(bias) > 0.5 && (
                        <span
                          className={cn(
                            "ml-1 text-[10px]",
                            bias > 0 ? "text-[#C54632]" : "text-[#4D7B3D]"
                          )}
                        >
                          {bias > 0 ? "+" : ""}
                          {bias.toFixed(1)}d
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums text-xs",
                        isVariable ? "text-[#B47214] font-500" : "text-[#6B6B66]"
                      )}
                    >
                      {sup.variability}d
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#6B6B66]">
                      {sup.confidence_band_95.lower}d–{sup.confidence_band_95.upper}d
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-600 text-[#1A1A17]">
                      {planningLead}d
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-[#6B6B66]">
                      {sup.sample_size}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded text-[11px] font-500",
                          verdictStyle
                        )}
                      >
                        {verdict}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-[#E5E5E2] bg-[#F7F7F5]">
            <p className="text-[11px] text-[#9B9B96]">
              Plan with = mean + 1.65σ (95th-percentile safe buffer). Sorted by largest bias
              first. Verdict: Reliable = bias ≤ 2d and σ ≤ 5d.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function R2Badge({ r2 }: { r2: number }) {
  const pct = Math.round(r2 * 100);
  const style =
    pct >= 50
      ? "bg-[#F2F8F0] text-[#4D7B3D]"
      : pct >= 25
      ? "bg-[#FDF8EE] text-[#B47214]"
      : "bg-[#F7F7F5] text-[#6B6B66]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-600", style)}>
      R² = {r2.toFixed(3)}
      <span className="font-400 opacity-80">({pct}% variance explained)</span>
    </span>
  );
}

function InsightCard({ text }: { text: string }) {
  return (
    <div className="flex gap-3 bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded-lg px-4 py-3">
      <span className="text-[#4D7B3D] shrink-0 mt-0.5 text-sm">●</span>
      <p className="text-sm text-[#1A1A17]">{text}</p>
    </div>
  );
}

function InsufficientData({ message }: { message?: string }) {
  return (
    <div className="bg-[#F7F7F5] border border-[#E5E5E2] rounded-lg px-6 py-10 text-center">
      <p className="text-sm font-500 text-[#1A1A17]">Insufficient data to run this model</p>
      {message && <p className="text-xs text-[#6B6B66] mt-1.5 max-w-sm mx-auto">{message}</p>}
    </div>
  );
}

function CoeffTable({ coefficients }: { coefficients: RegressionCoefficient[] }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E5E2]">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
          Regression coefficients
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E5E2] bg-[#F7F7F5]">
            <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Variable
            </th>
            <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Coeff.
            </th>
            <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Std error
            </th>
            <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              p-value
            </th>
            <th className="text-center px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Sig.
            </th>
            <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Interpretation
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E2]">
          {coefficients.map((c) => (
            <tr key={c.variable} className={cn("hover:bg-[#F7F7F5]", c.significant && c.variable !== "intercept" && "bg-[#FAFAF9]")}>
              <td className="px-4 py-2.5">
                <code className="text-xs font-mono text-[#1A1A17]">
                  {VAR_LABELS[c.variable] ?? c.variable}
                </code>
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right tabular-nums text-xs font-500",
                  c.variable === "intercept"
                    ? "text-[#6B6B66]"
                    : c.coefficient > 0
                    ? "text-[#4D7B3D]"
                    : "text-[#C54632]"
                )}
              >
                {c.coefficient >= 0 ? "+" : ""}
                {c.coefficient.toFixed(4)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                {c.std_error.toFixed(4)}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right tabular-nums text-xs",
                  c.p_value < 0.01
                    ? "text-[#4D7B3D] font-600"
                    : c.p_value < 0.05
                    ? "text-[#B47214] font-500"
                    : "text-[#9B9B96]"
                )}
              >
                {c.p_value < 0.001 ? "<0.001" : c.p_value.toFixed(4)}
              </td>
              <td className="px-4 py-2.5 text-center text-sm">
                {c.significant ? (
                  <span className="text-[#4D7B3D]">✓</span>
                ) : (
                  <span className="text-[#C8C8C4]">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-[#6B6B66] max-w-xs leading-snug">
                {c.interpretation}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-[#E5E5E2] bg-[#F7F7F5]">
        <p className="text-[11px] text-[#9B9B96]">
          ✓ = p &lt; 0.05 (two-tailed t-test, normal CDF approx.). Green = p &lt; 0.01, amber =
          p &lt; 0.05. Coeff. sign: green = positive effect, red = negative effect.
        </p>
      </div>
    </div>
  );
}

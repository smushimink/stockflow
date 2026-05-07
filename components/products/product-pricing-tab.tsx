"use client";

import { useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { InlineEdit } from "@/components/shared/inline-edit";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductMetrics, DataProvenance } from "@/lib/supabase/types";
import { ProductAnalyticsTab } from "@/components/products/product-analytics-tab";
import type { AnalyticsData } from "@/components/products/product-analytics-tab";

interface DailySales { date: string; units: number; }
interface CustomerBreakdown { id: string | null; name: string; qty: number; revenue: number; }
interface ProductPo {
  id: string; order_number: string; status: string; created_at: string;
  received_at: string | null; expected_at: string | null;
  qty_ordered: number; qty_received: number; unit_cost: number;
}

interface ProductPricingTabProps {
  product: Product;
  metrics: ProductMetrics | null;
  supplier: { id: string; name: string; lead_time_days: number; moq: number } | null;
  history: DataProvenance[];
  dailySales: DailySales[];
  customerBreakdown: CustomerBreakdown[];
  productPos: ProductPo[];
  analyticsData: AnalyticsData;
}

const priceSchema = z.number().min(0.01).max(999999);
const intGteZero = z.number().int().min(0);
const intGteOne = z.number().int().min(1);

type TabId = "pricing" | "sales" | "reorder" | "supplier" | "activity" | "analytics";

export function ProductPricingTab({
  product: initialProduct,
  metrics: initialMetrics,
  supplier,
  history,
  dailySales,
  customerBreakdown,
  productPos,
  analyticsData,
}: ProductPricingTabProps) {
  const [tab, setTab] = useState<TabId>("pricing");
  const [product, setProduct] = useState(initialProduct);
  const [metrics, setMetrics] = useState(initialMetrics);
  const supabase = createClient();

  async function saveSellPrice(value: number) {
    await supabase.from("products").update({ selling_price: value }).eq("id", product.id);
    const newMargin = product.unit_cost > 0 ? (value - product.unit_cost) / value : 0;
    setProduct((p) => ({ ...p, selling_price: value }));
    if (metrics) setMetrics((m) => m ? { ...m, real_margin_pct: newMargin } : m);
  }

  async function saveCostPrice(value: number) {
    await supabase.from("products").update({ unit_cost: value }).eq("id", product.id);
    const newMargin = value > 0 ? (product.selling_price - value) / product.selling_price : 0;
    setProduct((p) => ({ ...p, unit_cost: value }));
    if (metrics) setMetrics((m) => m ? { ...m, real_margin_pct: newMargin } : m);
  }

  async function saveReorderPoint(value: number) {
    await supabase.from("products").update({ reorder_point: value }).eq("id", product.id);
    setProduct((p) => ({ ...p, reorder_point: value }));
  }

  async function saveReorderQty(value: number) {
    await supabase.from("products").update({ reorder_qty: value }).eq("id", product.id);
    setProduct((p) => ({ ...p, reorder_qty: value }));
  }

  async function saveLeadTime(value: number) {
    await supabase.from("products").update({ lead_time_days: value }).eq("id", product.id);
    setProduct((p) => ({ ...p, lead_time_days: value }));
  }

  async function saveMoq(value: number) {
    await supabase.from("products").update({ moq: value }).eq("id", product.id);
    setProduct((p) => ({ ...p, moq: value }));
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: "pricing", label: "Pricing" },
    { id: "sales", label: "Sales history" },
    { id: "reorder", label: "Reorder logic" },
    { id: "supplier", label: "Supplier" },
    { id: "activity", label: "Activity" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E5E5E2] px-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "px-3 py-3 text-sm font-500 text-[#1A1A17] border-b-2 border-[#1A1A17] -mb-px whitespace-nowrap shrink-0"
                : "px-3 py-3 text-sm text-[#6B6B66] hover:text-[#1A1A17] transition-colors whitespace-nowrap shrink-0"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pricing ── */}
      {tab === "pricing" && (
        <div className="p-4 space-y-1">
          <PricingRow
            label="Selling price"
            value={
              <InlineEdit
                value={product.selling_price}
                displayValue={formatCurrency(product.selling_price)}
                schema={priceSchema}
                onSave={saveSellPrice}
                prefix="$"
              />
            }
          />
          <PricingRow
            label="Unit cost"
            value={
              <InlineEdit
                value={product.unit_cost}
                displayValue={formatCurrency(product.unit_cost)}
                schema={priceSchema}
                onSave={saveCostPrice}
                prefix="$"
              />
            }
          />
          <PricingRow
            label="Gross margin"
            value={
              <span className="text-sm tabular-nums text-[#1A1A17]">
                {product.selling_price > 0
                  ? `${(((product.selling_price - product.unit_cost) / product.selling_price) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            }
            computed
          />
          <PricingRow
            label="Real margin"
            value={
              <span className="text-sm tabular-nums text-[#1A1A17]">
                {metrics?.real_margin_pct !== undefined
                  ? `${((metrics.real_margin_pct as number) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            }
            computed
          />
          <PricingRow
            label="Suggested price (25% margin)"
            value={
              <span className="text-sm tabular-nums text-[#6B6B66]">
                {product.unit_cost > 0 ? formatCurrency(product.unit_cost / 0.75) : "—"}
              </span>
            }
            computed
          />
          {metrics && (
            <div className="pt-3 border-t border-[#E5E5E2] mt-3">
              <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">Real profitability</p>
              <TrueProfitabilityRows product={product} metrics={metrics} />
            </div>
          )}
        </div>
      )}

      {/* ── Sales history ── */}
      {tab === "sales" && (
        <SalesHistoryTab dailySales={dailySales} customerBreakdown={customerBreakdown} />
      )}

      {/* ── Reorder logic ── */}
      {tab === "reorder" && (
        <ReorderTab
          product={product}
          supplier={supplier}
          productPos={productPos}
          onSaveReorderPoint={saveReorderPoint}
          onSaveReorderQty={saveReorderQty}
          onSaveLeadTime={saveLeadTime}
          onSaveMoq={saveMoq}
        />
      )}

      {/* ── Supplier ── */}
      {tab === "supplier" && (
        <SupplierTab supplier={supplier} product={product} productPos={productPos} />
      )}

      {/* ── Analytics ── */}
      {tab === "analytics" && (
        <ProductAnalyticsTab data={analyticsData} onApplyPrice={saveSellPrice} />
      )}

      {/* ── Activity ── */}
      {tab === "activity" && (
        <div className="p-4">
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-xs">
                  <span className="text-[#6B6B66] shrink-0 tabular-nums">
                    {new Date(entry.changed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-[#1A1A17]">
                    <span className="font-500">{entry.field_name}</span>
                    {" "}{entry.old_value ? `${entry.old_value} → ${entry.new_value}` : `set to ${entry.new_value}`}
                    {" "}
                    <span className="text-[#6B6B66]">via {entry.source}</span>
                  </span>
                  {entry.notes && <span className="text-[#6B6B66]">{entry.notes}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6B6B66]">No activity yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sales history tab ────────────────────────────────────────────────────────

function SalesHistoryTab({
  dailySales,
  customerBreakdown,
}: {
  dailySales: DailySales[];
  customerBreakdown: CustomerBreakdown[];
}) {
  const BAR_W = 8;
  const BAR_GAP = 2;
  const SLOT = BAR_W + BAR_GAP;
  const CHART_H = 80;
  const LABEL_H = 20;
  const TOTAL_W = dailySales.length * SLOT;
  const TOTAL_H = CHART_H + LABEL_H;

  const maxUnits = Math.max(...dailySales.map((d) => d.units), 1);
  const totalUnits = dailySales.reduce((s, d) => s + d.units, 0);
  const avgPerDay = totalUnits / Math.max(dailySales.length, 1);

  const last30 = dailySales.slice(-30).reduce((s, d) => s + d.units, 0);
  const prior30 = dailySales.slice(-60, -30).reduce((s, d) => s + d.units, 0);
  const trend = prior30 > 0 ? ((last30 - prior30) / prior30) * 100 : null;

  const bestDay = dailySales.reduce(
    (best, d) => (d.units > best.units ? d : best),
    dailySales[0] ?? { date: "", units: 0 }
  );

  const monthLabels: { x: number; label: string }[] = [];
  let prevMonth = "";
  let prevLabelX = -60;
  dailySales.forEach((d, i) => {
    const month = d.date.substring(0, 7);
    if (month !== prevMonth) {
      prevMonth = month;
      const x = i * SLOT + BAR_W / 2;
      if (x - prevLabelX >= 40) {
        monthLabels.push({
          x,
          label: new Date(d.date + "T00:00:00").toLocaleString("en-AU", { month: "short" }),
        });
        prevLabelX = x;
      }
    }
  });

  return (
    <div className="p-4 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-0.5">
          <p className="text-xs text-[#6B6B66]">Best day</p>
          <p className="text-sm font-600 tabular-nums text-[#1A1A17]">{bestDay.units} units</p>
          <p className="text-xs text-[#6B6B66]">
            {bestDay.date
              ? new Date(bestDay.date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })
              : "—"}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-[#6B6B66]">Avg per day</p>
          <p className="text-sm font-600 tabular-nums text-[#1A1A17]">{avgPerDay.toFixed(1)}</p>
          <p className="text-xs text-[#6B6B66]">units/day (90d)</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-[#6B6B66]">Trend</p>
          {trend !== null ? (
            <p
              className="text-sm font-600 tabular-nums"
              style={{ color: trend > 5 ? "#4D7B3D" : trend < -10 ? "#C54632" : "#B47214" }}
            >
              {trend > 0 ? "+" : ""}
              {trend.toFixed(0)}%
            </p>
          ) : (
            <p className="text-sm font-600 text-[#6B6B66]">—</p>
          )}
          <p className="text-xs text-[#6B6B66]">vs prior 30d</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="overflow-x-auto -mx-4 px-4">
        <svg
          width={TOTAL_W}
          height={TOTAL_H}
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          style={{ display: "block" }}
        >
          {dailySales.map((d, i) => {
            const barH = Math.max(d.units > 0 ? 2 : 0, (d.units / maxUnits) * CHART_H);
            return (
              <rect
                key={d.date}
                x={i * SLOT}
                y={CHART_H - barH}
                width={BAR_W}
                height={barH}
                fill={d.units > 0 ? "#1A1A17" : "#E5E5E2"}
                rx={1}
              />
            );
          })}
          {monthLabels.map((ml) => (
            <text
              key={`${ml.label}-${ml.x}`}
              x={ml.x}
              y={TOTAL_H - 3}
              fontSize={9}
              fill="#6B6B66"
              textAnchor="middle"
            >
              {ml.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Customer breakdown */}
      {customerBreakdown.length > 0 ? (
        <div>
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">Top customers</p>
          <div className="space-y-1.5">
            {customerBreakdown.map((c) => (
              <div key={c.id ?? c.name} className="flex items-center justify-between text-sm">
                {c.id && c.id !== "unknown" ? (
                  <Link href={`/customers/${c.id}`} className="text-[#1A1A17] hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <span className="text-[#6B6B66]">{c.name}</span>
                )}
                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-[#6B6B66] text-xs">{c.qty} units</span>
                  <span className="text-[#1A1A17] font-500">{formatCurrency(c.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : totalUnits === 0 ? (
        <p className="text-sm text-[#6B6B66]">No completed sales in the last 90 days.</p>
      ) : null}
    </div>
  );
}

// ── Reorder logic tab ────────────────────────────────────────────────────────

function ReorderTab({
  product,
  supplier,
  productPos,
  onSaveReorderPoint,
  onSaveReorderQty,
  onSaveLeadTime,
  onSaveMoq,
}: {
  product: Product;
  supplier: { id: string; name: string; lead_time_days: number; moq: number } | null;
  productPos: ProductPo[];
  onSaveReorderPoint: (v: number) => Promise<void>;
  onSaveReorderQty: (v: number) => Promise<void>;
  onSaveLeadTime: (v: number) => Promise<void>;
  onSaveMoq: (v: number) => Promise<void>;
}) {
  const reorderPoint = (product.reorder_point as number) ?? 0;
  const reorderQty = (product.reorder_qty as number) ?? 0;
  const current = product.stock_on_hand as number;
  const target = reorderPoint + reorderQty;
  const maxVal = Math.max(current, target, 10);

  const currentPct = Math.min((current / maxVal) * 100, 100);
  const reorderPct = Math.min((reorderPoint / maxVal) * 100, 100);
  const targetPct = Math.min((target / maxVal) * 100, 100);

  const barColor =
    current <= reorderPoint ? "#C54632" : current <= reorderPoint * 1.5 ? "#B47214" : "#4D7B3D";

  const lastReceived = productPos.find((p) => p.status === "received");
  const lastReceivedDaysAgo = lastReceived
    ? Math.round(
        (Date.now() - new Date(lastReceived.received_at ?? lastReceived.created_at).getTime()) /
          86400000
      )
    : null;

  const leadTime = (product.lead_time_days as number | null) ?? supplier?.lead_time_days ?? 0;
  const moq = (product.moq as number | null) ?? supplier?.moq ?? 0;

  return (
    <div className="p-4 space-y-4">
      {/* Stock level bar */}
      <div className="space-y-1.5">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Stock level</p>
        <div className="relative h-3 bg-[#F7F7F5] rounded-full">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all"
            style={{ width: `${currentPct}%`, background: barColor }}
          />
          {reorderPoint > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#B47214]"
              style={{ left: `${reorderPct}%` }}
            />
          )}
          {target > 0 && targetPct < 100 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[#6B6B66]/40"
              style={{ left: `${targetPct}%` }}
            />
          )}
        </div>
        <div className="flex gap-4 text-[10px] text-[#6B6B66]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-1.5 rounded-sm" style={{ background: barColor }} />
            On hand ({current})
          </span>
          {reorderPoint > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-px h-3 bg-[#B47214]" />
              Reorder ({reorderPoint})
            </span>
          )}
          {target > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-px h-3 bg-[#6B6B66]/40" />
              Target ({target})
            </span>
          )}
        </div>
      </div>

      {lastReceived && lastReceivedDaysAgo !== null && (
        <p className="text-xs text-[#6B6B66]">
          Last reorder:{" "}
          <span className="text-[#1A1A17]">{lastReceivedDaysAgo} days ago</span>
          {" · "}{lastReceived.qty_received} units{" · "}
          <Link href={`/purchases/${lastReceived.id}`} className="hover:underline">
            {lastReceived.order_number}
          </Link>
        </p>
      )}

      {/* Editable fields */}
      <div className="space-y-1">
        <PricingRow
          label="Reorder point"
          value={
            <InlineEdit value={reorderPoint} schema={intGteZero} onSave={onSaveReorderPoint} suffix=" units" />
          }
        />
        <PricingRow
          label="Reorder qty"
          value={
            <InlineEdit value={reorderQty} schema={intGteOne} onSave={onSaveReorderQty} suffix=" units" />
          }
        />
        <PricingRow
          label="Lead time"
          value={
            <InlineEdit value={leadTime} schema={intGteZero} onSave={onSaveLeadTime} suffix=" days" />
          }
        />
        <PricingRow
          label="Min order qty"
          value={
            <InlineEdit value={moq} schema={intGteZero} onSave={onSaveMoq} suffix=" units" />
          }
        />
      </div>

      {/* Last 5 POs */}
      {productPos.length > 0 && (
        <div>
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">
            Recent purchase orders
          </p>
          <div className="space-y-1.5">
            {productPos.slice(0, 5).map((po) => (
              <div key={po.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/purchases/${po.id}`}
                    className="text-[#1A1A17] font-500 hover:underline"
                  >
                    {po.order_number}
                  </Link>
                  <PoStatusBadge status={po.status} />
                </div>
                <div className="flex items-center gap-3 tabular-nums text-[#6B6B66]">
                  <span>{po.qty_received}/{po.qty_ordered} units</span>
                  <span>{formatCurrency(po.unit_cost)}/unit</span>
                  <span>
                    {new Date(po.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Supplier tab ─────────────────────────────────────────────────────────────

function SupplierTab({
  supplier,
  product,
  productPos,
}: {
  supplier: { id: string; name: string; lead_time_days: number; moq: number } | null;
  product: Product;
  productPos: ProductPo[];
}) {
  if (!supplier) {
    return (
      <div className="p-4">
        <p className="text-sm text-[#6B6B66]">No supplier linked to this product.</p>
      </div>
    );
  }

  const totalOrdered = productPos.reduce((s, p) => s + p.qty_ordered, 0);
  const totalReceived = productPos.reduce((s, p) => s + p.qty_received, 0);
  const fillRate = totalOrdered > 0 ? totalReceived / totalOrdered : null;

  const leadTime = (product.lead_time_days as number | null) ?? supplier.lead_time_days;
  const moq = (product.moq as number | null) ?? supplier.moq;

  return (
    <div className="p-4 space-y-4">
      <div className="border border-[#E5E5E2] rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#6B6B66] mb-0.5">Supplier</p>
            <p className="text-base font-600 text-[#1A1A17]">{supplier.name}</p>
          </div>
          <Link
            href={`/suppliers/${supplier.id}`}
            className="text-xs text-[#6B6B66] border border-[#E5E5E2] rounded px-2 py-1 hover:border-[#C8C8C4] hover:text-[#1A1A17] transition-colors shrink-0"
          >
            View supplier →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[#6B6B66] mb-0.5">Lead time</p>
            <p className="text-sm font-500 text-[#1A1A17]">{leadTime} days</p>
          </div>
          <div>
            <p className="text-xs text-[#6B6B66] mb-0.5">Min order</p>
            <p className="text-sm font-500 text-[#1A1A17]">{moq} units</p>
          </div>
          {fillRate !== null && (
            <div>
              <p className="text-xs text-[#6B6B66] mb-0.5">Fill rate</p>
              <p
                className="text-sm font-500 tabular-nums"
                style={{
                  color:
                    fillRate >= 0.95 ? "#4D7B3D" : fillRate >= 0.8 ? "#B47214" : "#C54632",
                }}
              >
                {(fillRate * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/purchases/new?supplier=${supplier.id}&product=${product.id}`}
        className="flex items-center justify-center w-full py-2 px-4 text-sm font-500 text-white bg-[#1A1A17] rounded-lg hover:bg-[#2D2D29] transition-colors"
      >
        Order from this supplier
      </Link>
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function PricingRow({
  label,
  value,
  computed,
}: {
  label: string;
  value: React.ReactNode;
  computed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${computed ? "text-[#6B6B66]" : "text-[#1A1A17]"}`}>{label}</span>
      {value}
    </div>
  );
}

function PoStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    received: { label: "Received", color: "#4D7B3D", bg: "#F2F8F0" },
    ordered: { label: "Ordered", color: "#B47214", bg: "#FDF8EE" },
    partial: { label: "Partial", color: "#B47214", bg: "#FDF8EE" },
    cancelled: { label: "Cancelled", color: "#6B6B66", bg: "#F7F7F5" },
    draft: { label: "Draft", color: "#6B6B66", bg: "#F7F7F5" },
  };
  const c = cfg[status] ?? cfg.draft;
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-500"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

function TrueProfitabilityRows({
  product,
  metrics,
}: {
  product: Product;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: any;
}) {
  const avgDiscount = (metrics.avg_discount as number) ?? 0;
  const profitPerUnit = product.selling_price - product.unit_cost - avgDiscount;
  const marginPct = product.selling_price > 0 ? profitPerUnit / product.selling_price : 0;
  const turnover = (metrics.inventory_turnover as number) ?? 0;
  const cashLocked = (product.stock_on_hand as number) * product.unit_cost;
  const potentialProfit = (product.stock_on_hand as number) * profitPerUnit;
  const daysOfCover = (metrics.days_of_cover as number) ?? 0;
  const daysToRecover = daysOfCover >= 9999 ? null : Math.round(daysOfCover);

  return (
    <div className="space-y-1">
      <PricingRow
        label="Gross profit per unit"
        value={
          <span
            className="text-sm tabular-nums"
            style={{ color: profitPerUnit > 0 ? "#4D7B3D" : "#C54632" }}
          >
            {formatCurrency(profitPerUnit)}
          </span>
        }
        computed
      />
      <PricingRow
        label="Gross margin"
        value={
          <span
            className="text-sm tabular-nums font-500"
            style={{
              color:
                marginPct >= 0.25 ? "#4D7B3D" : marginPct >= 0.15 ? "#B47214" : "#C54632",
            }}
          >
            {(marginPct * 100).toFixed(1)}%
          </span>
        }
        computed
      />
      {turnover > 0 && (
        <PricingRow
          label="Inventory turnover"
          value={
            <span
              className="text-sm tabular-nums"
              style={{
                color: turnover >= 4 ? "#4D7B3D" : turnover >= 2 ? "#B47214" : "#C54632",
              }}
            >
              {turnover.toFixed(1)}× per year
            </span>
          }
          computed
        />
      )}
      <PricingRow
        label="Cash locked in this SKU"
        value={
          <span className="text-sm tabular-nums text-[#6B6B66]">{formatCurrency(cashLocked)}</span>
        }
        computed
      />
      {(product.stock_on_hand as number) > 0 && (
        <PricingRow
          label="Profit if all stock sold"
          value={
            <span
              className="text-sm tabular-nums"
              style={{ color: potentialProfit > 0 ? "#4D7B3D" : "#C54632" }}
            >
              {formatCurrency(potentialProfit)}
            </span>
          }
          computed
        />
      )}
      {daysToRecover !== null && (
        <PricingRow
          label="Days to recover cash"
          value={
            <span
              className="text-sm tabular-nums"
              style={{
                color:
                  daysToRecover <= 30 ? "#4D7B3D" : daysToRecover <= 90 ? "#B47214" : "#C54632",
              }}
            >
              {daysToRecover} days
            </span>
          }
          computed
        />
      )}
    </div>
  );
}

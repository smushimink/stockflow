"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { InlineEdit } from "@/components/shared/inline-edit";
import { z } from "zod";
import { updateSupplier } from "@/app/(dashboard)/suppliers/actions";
import { ChevronRight } from "lucide-react";
import type { Supplier } from "@/lib/supabase/types";
import type { SupplierPo, SupplierProduct } from "@/app/(dashboard)/suppliers/[id]/page";
import { SupplierEconomicAnalysis } from "@/components/suppliers/supplier-economic-analysis";
import type { SupplierEconomicData } from "@/components/suppliers/supplier-economic-analysis";

type Tab = "overview" | "products" | "orders" | "performance" | "profitability" | "economics";

interface SupplierAlert {
  id: string;
  severity: string;
  title: string;
  summary: string;
  created_at: string;
  status: string;
}

interface Props {
  supplier: Supplier;
  products: SupplierProduct[];
  pos: SupplierPo[];
  alerts: SupplierAlert[];
  economicData: SupplierEconomicData;
}

export function SupplierDetailClient({ supplier: initial, products, pos, alerts, economicData }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [supplier, setSupplier] = useState(initial);

  const now = Date.now();
  const receivedPos = pos.filter((p) => p.status === "received");

  const totalSpend90d = receivedPos
    .filter((p) => p.received_at && new Date(p.received_at).getTime() >= now - 90 * 86400000)
    .reduce((s, p) => s + p.total, 0);

  const withExpected = receivedPos.filter((p) => p.expected_at && p.received_at);
  const onTimeCount = withExpected.filter(
    (p) => new Date(p.received_at!) <= new Date(p.expected_at!)
  ).length;
  const onTimeRate = withExpected.length > 0 ? onTimeCount / withExpected.length : null;

  const allItems = receivedPos.flatMap((p) => p.items);
  const totalOrdered = allItems.reduce((s, i) => s + i.qty_ordered, 0);
  const totalReceived = allItems.reduce((s, i) => s + i.qty_received, 0);
  const fillRate = totalOrdered > 0 ? totalReceived / totalOrdered : null;

  const lastOrderByProduct = new Map<string, string>();
  for (const po of pos) {
    for (const item of po.items) {
      if (item.product_id) {
        const cur = lastOrderByProduct.get(item.product_id);
        if (!cur || po.created_at > cur) lastOrderByProduct.set(item.product_id, po.created_at);
      }
    }
  }

  async function save(fields: Parameters<typeof updateSupplier>[1]) {
    await updateSupplier(supplier.id, fields);
    setSupplier((s) => ({ ...s, ...fields }));
  }

  const pendingAlerts = alerts.filter((a) => a.status === "pending");

  const TABS = [
    ["overview", "Overview"],
    ["products", `Products (${products.length})`],
    ["orders", `Purchase Orders (${pos.length})`],
    ["performance", "Performance"],
    ["profitability", "Profitability"],
    ["economics", "Economic analysis"],
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#6B6B66]">
        <Link href="/suppliers" className="hover:text-[#1A1A17]">
          Suppliers
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#1A1A17] font-500">{supplier.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-600 text-[#1A1A17]">{supplier.name}</h1>
            {supplier.code && (
              <span className="text-xs font-500 border border-[#E5E5E2] rounded px-2 py-0.5 text-[#6B6B66]">
                {supplier.code}
              </span>
            )}
            <span
              className={cn(
                "text-xs font-500 rounded px-2 py-0.5",
                supplier.active ? "bg-[#F2F8F0] text-[#4D7B3D]" : "bg-[#F7F7F5] text-[#6B6B66]"
              )}
            >
              {supplier.active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-[#6B6B66]">Lead time: {supplier.lead_time_days}d</span>
            <span className="text-[#E5E5E2]">·</span>
            <span className="text-xs text-[#6B6B66]">MOQ: {supplier.moq}</span>
            <span className="text-[#E5E5E2]">·</span>
            <span className="text-xs text-[#6B6B66]">{supplier.currency}</span>
            {supplier.contact_email && (
              <>
                <span className="text-[#E5E5E2]">·</span>
                <span className="text-xs text-[#6B6B66]">{supplier.contact_email}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTab("overview")}
            className="text-sm font-500 px-3 py-1.5 rounded-lg border border-[#E5E5E2] bg-white hover:border-[#C8C8C4] text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
          >
            Edit
          </button>
          <Link
            href={`/purchases/new?supplier=${supplier.id}`}
            className="text-sm font-500 px-3 py-1.5 rounded-lg bg-[#1A1A17] text-white hover:bg-[#2D2D29] transition-colors"
          >
            Create PO
          </Link>
        </div>
      </div>

      {/* Pending alerts */}
      {pendingAlerts.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 bg-[#FDF8EE] border border-[#B47214]/20 rounded-lg px-4 py-3"
        >
          <div className="w-2 h-2 rounded-full bg-[#B47214] mt-1 shrink-0" />
          <div>
            <p className="text-sm font-500 text-[#1A1A17]">{a.title}</p>
            <p className="text-xs text-[#6B6B66] mt-0.5">{a.summary}</p>
          </div>
        </div>
      ))}

      {/* 3-metric row */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total spend (90d)"
          value={formatCurrency(totalSpend90d)}
          sub={`${receivedPos.length} received orders total`}
        />
        <MetricCard
          label="On-time rate"
          value={onTimeRate !== null ? `${(onTimeRate * 100).toFixed(0)}%` : "—"}
          sub={
            withExpected.length > 0
              ? `${onTimeCount} of ${withExpected.length} POs on time`
              : "No data yet"
          }
          valueColor={
            onTimeRate === null
              ? undefined
              : onTimeRate >= 0.8
              ? "#4D7B3D"
              : onTimeRate >= 0.6
              ? "#B47214"
              : "#C54632"
          }
        />
        <MetricCard
          label="Fill rate"
          value={fillRate !== null ? `${(fillRate * 100).toFixed(0)}%` : "—"}
          sub={totalOrdered > 0 ? `${totalReceived} of ${totalOrdered} units received` : "No data"}
          valueColor={
            fillRate === null
              ? undefined
              : fillRate >= 0.9
              ? "#4D7B3D"
              : fillRate >= 0.7
              ? "#B47214"
              : "#C54632"
          }
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E5E2]">
        <div className="flex gap-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-3 py-2 text-sm font-500 transition-colors border-b-2 -mb-px",
                tab === key
                  ? "border-[#1A1A17] text-[#1A1A17]"
                  : "border-transparent text-[#6B6B66] hover:text-[#1A1A17]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab supplier={supplier} onSave={save} />}
      {tab === "products" && (
        <ProductsTab products={products} lastOrderByProduct={lastOrderByProduct} />
      )}
      {tab === "orders" && <OrdersTab pos={pos} />}
      {tab === "performance" && (
        <PerformanceTab
          pos={pos}
          promisedLeadTime={supplier.lead_time_days}
          onTimeRate={onTimeRate}
          fillRate={fillRate}
        />
      )}
      {tab === "profitability" && <ProfitabilityTab products={products} />}
      {tab === "economics" && (
        <SupplierEconomicAnalysis
          pos={pos}
          products={products}
          economic={economicData}
          promisedLeadTime={supplier.lead_time_days}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-lg font-600 tabular-nums" style={{ color: valueColor ?? "#1A1A17" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#6B6B66]">{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-[#6B6B66] shrink-0 w-28">{label}</p>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

function NotesField({
  value: initialValue,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  const [text, setText] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    const newVal = text || null;
    if (newVal === (initialValue || null)) return;
    setSaving(true);
    try {
      await onSave(newVal);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg p-5">
      <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-3">Notes</p>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          placeholder="Add notes about this supplier…"
          className="w-full text-sm text-[#1A1A17] border border-[#E5E5E2] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A1A17] transition-colors placeholder:text-[#C8C8C4]"
        />
        {saving && (
          <span className="absolute top-2 right-2 text-[10px] text-[#6B6B66]">Saving…</span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(100, value * 100));
  const color = value >= 0.8 ? "#4D7B3D" : value >= 0.6 ? "#B47214" : "#C54632";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#F0F0EE] rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums font-500" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  supplier,
  onSave,
}: {
  supplier: Supplier;
  onSave: (fields: Parameters<typeof updateSupplier>[1]) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Contact */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-5 space-y-3">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Contact</p>
          <Field label="Name">
            <InlineEdit
              value={supplier.contact_name ?? ""}
              schema={z.string()}
              onSave={(v) => onSave({ contact_name: v || null })}
            />
          </Field>
          <Field label="Email">
            <InlineEdit
              value={supplier.contact_email ?? ""}
              schema={z.string()}
              onSave={(v) => onSave({ contact_email: v || null })}
              inputClassName="w-[200px]"
            />
          </Field>
          <Field label="Phone">
            <InlineEdit
              value={supplier.contact_phone ?? ""}
              schema={z.string()}
              onSave={(v) => onSave({ contact_phone: v || null })}
              inputClassName="w-[160px]"
            />
          </Field>
        </div>

        {/* Terms */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-5 space-y-3">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            Terms &amp; Settings
          </p>
          <Field label="Lead time">
            <InlineEdit
              value={supplier.lead_time_days}
              schema={z.number().int().min(0)}
              onSave={(v) => onSave({ lead_time_days: v })}
              suffix=" days"
            />
          </Field>
          <Field label="MOQ">
            <InlineEdit
              value={supplier.moq}
              schema={z.number().int().min(1)}
              onSave={(v) => onSave({ moq: v })}
              suffix=" units"
            />
          </Field>
          <Field label="Currency">
            <InlineEdit
              value={supplier.currency}
              schema={z.string().min(1).max(10)}
              onSave={(v) => onSave({ currency: v })}
            />
          </Field>
          <Field label="Payment terms">
            <InlineEdit
              value={supplier.payment_terms ?? ""}
              schema={z.string()}
              onSave={(v) => onSave({ payment_terms: v || null })}
              inputClassName="w-[180px]"
            />
          </Field>
        </div>
      </div>

      <NotesField value={supplier.notes} onSave={(v) => onSave({ notes: v })} />
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────

function ProductsTab({
  products,
  lastOrderByProduct,
}: {
  products: SupplierProduct[];
  lastOrderByProduct: Map<string, string>;
}) {
  if (products.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E2] rounded-lg py-12 text-center">
        <p className="text-sm text-[#6B6B66]">No products linked to this supplier.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E5E2]">
            <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              SKU
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Name
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Category
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Stock
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Unit cost
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Last ordered
            </th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E2]">
          {products.map((p) => {
            const lastOrder = lastOrderByProduct.get(p.id);
            return (
              <tr key={p.id} className="hover:bg-[#F7F7F5]">
                <td className="px-4 py-2.5 text-xs font-500 tabular-nums text-[#1A1A17]">
                  {p.sku}
                </td>
                <td className="px-4 py-2.5 text-[#1A1A17] max-w-[180px] truncate">{p.name}</td>
                <td className="px-4 py-2.5 text-xs text-[#6B6B66]">{p.category ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">
                  {p.stock_on_hand}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                  {formatCurrency(p.unit_cost)}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#6B6B66]">
                  {lastOrder
                    ? new Date(lastOrder).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Never"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-xs text-[#6B6B66] hover:text-[#1A1A17] underline-offset-2 hover:underline transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { dot: string; label: string }> = {
  draft: { dot: "bg-[#C8C8C4]", label: "Draft" },
  sent: { dot: "bg-[#B47214]", label: "Sent" },
  confirmed: { dot: "bg-[#4D7B3D]", label: "Confirmed" },
  received: { dot: "bg-[#4D7B3D]", label: "Received" },
  cancelled: { dot: "bg-[#C54632]", label: "Cancelled" },
};

function OrdersTab({ pos }: { pos: SupplierPo[] }) {
  if (pos.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E2] rounded-lg py-12 text-center">
        <p className="text-sm text-[#6B6B66]">No purchase orders for this supplier yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E5E2]">
            <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Order #
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Status
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Items
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Total
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Expected
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E5E2]">
          {pos.map((po) => {
            const sm = STATUS_META[po.status] ?? { dot: "bg-[#C8C8C4]", label: po.status };
            return (
              <tr key={po.id} className="hover:bg-[#F7F7F5]">
                <td className="px-4 py-2.5 font-500 text-[#1A1A17] tabular-nums">
                  {po.order_number}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", sm.dot)} />
                    <span className="text-xs text-[#6B6B66] capitalize">{sm.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                  {po.items.length}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">
                  {formatCurrency(po.total)}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#6B6B66]">
                  {po.expected_at
                    ? new Date(po.expected_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#6B6B66]">
                  {new Date(po.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/purchases/${po.id}`}
                    className="text-xs text-[#6B6B66] hover:text-[#1A1A17] underline-offset-2 hover:underline transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Profitability Tab ─────────────────────────────────────────────────────────

function ProfitabilityTab({ products }: { products: SupplierProduct[] }) {
  const withRevenue = products.filter((p) => p.revenue_90d > 0);
  const totalProfit = products.reduce((s, p) => s + p.gross_profit_90d, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue_90d, 0);
  const weightedMargin = totalRevenue > 0 ? totalProfit / totalRevenue : null;

  const sorted = [...products].sort((a, b) => b.gross_margin_pct - a.gross_margin_pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const renegotiate = products
    .filter((p) => p.revenue_90d > 0 && p.gross_margin_pct < 0.2)
    .sort((a, b) => b.revenue_90d - a.revenue_90d);

  if (products.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E2] rounded-lg py-12 text-center">
        <p className="text-sm text-[#6B6B66]">No products linked to this supplier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total profit unlocked (90d)"
          value={formatCurrency(totalProfit)}
          sub={`from ${withRevenue.length} SKUs with sales`}
        />
        <MetricCard
          label="Avg margin on supplied"
          value={weightedMargin !== null ? `${(weightedMargin * 100).toFixed(1)}%` : "—"}
          sub="Weighted by revenue"
          valueColor={
            weightedMargin === null
              ? undefined
              : weightedMargin >= 0.25
              ? "#4D7B3D"
              : weightedMargin >= 0.15
              ? "#B47214"
              : "#C54632"
          }
        />
        <MetricCard
          label="Revenue from this supplier (90d)"
          value={formatCurrency(totalRevenue)}
          sub={`${products.length} products supplied`}
        />
      </div>

      {/* Best & worst */}
      {best && worst && best.id !== worst.id && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded-lg p-4">
            <p className="text-xs font-600 text-[#4D7B3D] uppercase tracking-wider mb-2">
              Best margin product
            </p>
            <p className="text-sm font-600 text-[#1A1A17]">{best.sku} — {best.name}</p>
            <p className="text-xs text-[#6B6B66] mt-0.5">
              {(best.gross_margin_pct * 100).toFixed(1)}% margin ·{" "}
              {formatCurrency(best.gross_profit_90d)} profit (90d)
            </p>
          </div>
          <div className="bg-[#FDF8EE] border border-[#B47214]/20 rounded-lg p-4">
            <p className="text-xs font-600 text-[#B47214] uppercase tracking-wider mb-2">
              Worst margin product
            </p>
            <p className="text-sm font-600 text-[#1A1A17]">{worst.sku} — {worst.name}</p>
            <p className="text-xs text-[#6B6B66] mt-0.5">
              {(worst.gross_margin_pct * 100).toFixed(1)}% margin ·{" "}
              {formatCurrency(worst.revenue_90d)} revenue at risk
            </p>
          </div>
        </div>
      )}

      {/* All products by margin */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E2]">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            All products — sorted by margin
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Rev 90d</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Profit 90d</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Margin</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Turnover</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {sorted.map((p) => {
              const margin = p.gross_margin_pct;
              const color = margin >= 0.25 ? "#4D7B3D" : margin >= 0.15 ? "#B47214" : "#C54632";
              return (
                <tr key={p.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-2.5 text-xs font-500 tabular-nums text-[#1A1A17]">{p.sku}</td>
                  <td className="px-4 py-2.5 text-xs text-[#6B6B66] max-w-[160px] truncate">{p.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                    {p.revenue_90d > 0 ? formatCurrency(p.revenue_90d) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-500 text-[#1A1A17]">
                    {p.gross_profit_90d > 0 ? formatCurrency(p.gross_profit_90d) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-600" style={{ color }}>
                    {p.revenue_90d > 0 ? `${(margin * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                    {p.inventory_turnover > 0 ? `${p.inventory_turnover.toFixed(1)}×` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Renegotiation opportunities */}
      {renegotiate.length > 0 && (
        <div className="bg-[#FDF8EE] border border-[#B47214]/20 rounded-lg p-4">
          <p className="text-xs font-600 text-[#B47214] uppercase tracking-wider mb-2">
            Renegotiation opportunities — under 20% margin
          </p>
          <div className="space-y-1.5">
            {renegotiate.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-500 text-[#1A1A17]">{p.sku}</span>
                  <span className="text-xs text-[#6B6B66] ml-2">{p.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-600 text-[#C54632]">
                    {(p.gross_margin_pct * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-[#6B6B66] ml-2">{formatCurrency(p.revenue_90d)} rev</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

function PerformanceTab({
  pos,
  promisedLeadTime,
  onTimeRate,
  fillRate,
}: {
  pos: SupplierPo[];
  promisedLeadTime: number;
  onTimeRate: number | null;
  fillRate: number | null;
}) {
  const now = Date.now();
  const oneYearAgo = new Date(now - 365 * 86400000);
  const twoYearsAgo = new Date(now - 2 * 365 * 86400000);

  const receivedPos = pos.filter((p) => p.status === "received");

  const thisYearPos = pos.filter((p) => new Date(p.created_at) >= oneYearAgo);
  const lastYearPos = pos.filter((p) => {
    const d = new Date(p.created_at);
    return d >= twoYearsAgo && d < oneYearAgo;
  });
  const thisYearSpend = thisYearPos
    .filter((p) => p.status === "received")
    .reduce((s, p) => s + p.total, 0);
  const lastYearSpend = lastYearPos
    .filter((p) => p.status === "received")
    .reduce((s, p) => s + p.total, 0);

  const leadTimeData = receivedPos
    .filter((p) => p.received_at)
    .map((p) => {
      const actualDays = Math.round(
        (new Date(p.received_at!).getTime() - new Date(p.created_at).getTime()) / 86400000
      );
      const delta = actualDays - promisedLeadTime;
      const onTime = p.expected_at ? new Date(p.received_at!) <= new Date(p.expected_at) : null;
      const fillItems = p.items;
      const ordered = fillItems.reduce((s, i) => s + i.qty_ordered, 0);
      const received = fillItems.reduce((s, i) => s + i.qty_received, 0);
      const poFillRate = ordered > 0 ? received / ordered : null;
      return { po: p, actualDays, delta, onTime, poFillRate };
    });

  const avgLeadTime =
    leadTimeData.length > 0
      ? leadTimeData.reduce((s, d) => s + d.actualDays, 0) / leadTimeData.length
      : null;

  if (receivedPos.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E2] rounded-lg py-12 text-center">
        <p className="text-sm text-[#6B6B66]">No received orders — performance data unavailable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scorecard */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-5 space-y-4">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Delivery</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B6B66]">On-time rate</span>
                <span className="font-500 text-[#1A1A17]">
                  {onTimeRate !== null ? `${(onTimeRate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
              {onTimeRate !== null && <ProgressBar value={onTimeRate} />}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#6B6B66]">Fill rate</span>
                <span className="font-500 text-[#1A1A17]">
                  {fillRate !== null ? `${(fillRate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
              {fillRate !== null && <ProgressBar value={fillRate} />}
            </div>
            {avgLeadTime !== null && (
              <div className="pt-1 border-t border-[#F0F0EE]">
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B6B66]">Avg lead time</span>
                  <span
                    className={cn(
                      "font-500 tabular-nums",
                      avgLeadTime <= promisedLeadTime
                        ? "text-[#4D7B3D]"
                        : avgLeadTime <= promisedLeadTime * 1.3
                        ? "text-[#B47214]"
                        : "text-[#C54632]"
                    )}
                  >
                    {avgLeadTime.toFixed(1)}d{" "}
                    <span className="text-[#6B6B66] font-400">
                      (promised {promisedLeadTime}d)
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E2] rounded-lg p-5 space-y-4">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            Year over year
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B6B66]">Last 12 months</span>
              <div className="text-right">
                <p className="text-sm font-600 tabular-nums text-[#1A1A17]">
                  {formatCurrency(thisYearSpend)}
                </p>
                <p className="text-xs text-[#6B6B66]">{thisYearPos.length} orders</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B6B66]">Prior 12 months</span>
              <div className="text-right">
                <p className="text-sm font-600 tabular-nums text-[#1A1A17]">
                  {formatCurrency(lastYearSpend)}
                </p>
                <p className="text-xs text-[#6B6B66]">{lastYearPos.length} orders</p>
              </div>
            </div>
            {lastYearSpend > 0 && (
              <div className="pt-1 border-t border-[#F0F0EE]">
                <div className="flex justify-between text-xs">
                  <span className="text-[#6B6B66]">Spend change</span>
                  <span
                    className={cn(
                      "font-500 tabular-nums",
                      thisYearSpend >= lastYearSpend ? "text-[#4D7B3D]" : "text-[#C54632]"
                    )}
                  >
                    {thisYearSpend >= lastYearSpend ? "+" : ""}
                    {(((thisYearSpend - lastYearSpend) / lastYearSpend) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lead time per PO table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E2]">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
            Lead time accuracy — received orders
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Order
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Created
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Received
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Promised
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Actual
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                On time
              </th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                Fill rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {leadTimeData.map(({ po, actualDays, delta, onTime, poFillRate }) => (
              <tr key={po.id} className="hover:bg-[#F7F7F5]">
                <td className="px-4 py-2.5 font-500 text-[#1A1A17]">{po.order_number}</td>
                <td className="px-4 py-2.5 text-right text-xs text-[#6B6B66]">
                  {new Date(po.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#6B6B66]">
                  {po.received_at
                    ? new Date(po.received_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                  {promisedLeadTime}d
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right tabular-nums text-xs font-500",
                    delta <= 0
                      ? "text-[#4D7B3D]"
                      : delta <= Math.ceil(promisedLeadTime * 0.3)
                      ? "text-[#B47214]"
                      : "text-[#C54632]"
                  )}
                >
                  {actualDays}d{delta > 0 && ` (+${delta})`}
                </td>
                <td className="px-4 py-2.5 text-right text-xs">
                  {onTime === null ? (
                    <span className="text-[#6B6B66]">—</span>
                  ) : onTime ? (
                    <span className="text-[#4D7B3D]">✓</span>
                  ) : (
                    <span className="text-[#C54632]">✗</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[#6B6B66]">
                  {poFillRate !== null ? `${(poFillRate * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { calcPoBreakEven } from "@/lib/analytics/break-even";

interface Supplier {
  id: string;
  name: string;
  lead_time_days: number;
  moq: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  unit_cost: number;
  selling_price: number;
  avg_daily_sales_30d: number;
  supplier_id: string | null;
  moq: number | null;
  stock_on_hand: number;
}

interface LineItem {
  productId: string | null;
  sku: string;
  name: string;
  qty: number;
  unitCost: number;
}

interface Prefill {
  alertId?: string;
  supplierId?: string;
  items?: LineItem[];
}

interface PoFormProps {
  suppliers: Supplier[];
  products: Product[];
  prefill?: Prefill;
}

function emptyItem(): LineItem {
  return { productId: null, sku: "", name: "", qty: 1, unitCost: 0 };
}

// ── Product Combobox ──────────────────────────────────────────────────────────

interface ProductComboboxProps {
  products: Product[];
  value: string | null;
  onChange: (productId: string) => void;
}

function ProductCombobox({ products, value, onChange }: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const selected = products.find((p) => p.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-sm border border-[#E5E5E2] rounded px-2 py-1.5 bg-white text-left focus:outline-none focus:ring-1 focus:ring-[#1A1A17] flex items-center justify-between gap-2"
      >
        <span className={cn("truncate text-xs", selected ? "text-[#1A1A17]" : "text-[#6B6B66]")}>
          {selected ? `${selected.sku} — ${selected.name}` : "— Select product —"}
        </span>
        <ChevronDown size={12} className="text-[#6B6B66] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#E5E5E2] rounded-md shadow-lg overflow-hidden min-w-[280px]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E5E5E2]">
            <Search size={12} className="text-[#6B6B66] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU or name…"
              className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-[#C8C8C4]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[#6B6B66] text-center">No products found</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before click registers
                    onChange(p.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#F7F7F5] flex items-center gap-3"
                >
                  <span className="text-xs font-600 text-[#1A1A17] shrink-0 tabular-nums w-20 truncate">{p.sku}</span>
                  <span className="text-xs text-[#6B6B66] truncate flex-1">{p.name}</span>
                  <span className="text-xs text-[#C8C8C4] shrink-0">{p.stock_on_hand} on hand</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export function PoForm({ suppliers, products, prefill }: PoFormProps) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState(prefill?.supplierId ?? "");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>(
    prefill?.items?.length ? prefill.items : [emptyItem()]
  );
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<"draft" | "sent">("draft");

  const productMap = new Map(products.map((p) => [p.id, p]));

  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function selectProduct(idx: number, productId: string) {
    const p = productMap.get(productId);
    if (!p) return;
    setItem(idx, {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unitCost: p.unit_cost,
      qty: p.moq ?? 1,
    });
    if (!supplierId && p.supplier_id) setSupplierId(p.supplier_id);
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const filledItems = items.filter((i) => i.sku.trim() && i.qty > 0);

  // Live break-even calc: enrich filled items with selling_price + avg_daily_sales
  const beItems = filledItems
    .filter((i) => i.productId !== null)
    .map((i) => {
      const p = productMap.get(i.productId!);
      return {
        productId: i.productId,
        qty: i.qty,
        unitCost: i.unitCost,
        sellingPrice: p?.selling_price ?? 0,
        avgDailySales: p?.avg_daily_sales_30d ?? 0,
      };
    });
  const breakEven = calcPoBreakEven(beItems);

  async function submit(mode: "draft" | "sent") {
    if (filledItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSavingMode(mode);
    setSaving(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId || null,
          expected_at: expectedAt || null,
          notes: notes || null,
          status: mode,
          items: filledItems.map((i) => ({
            product_id: i.productId ?? null,
            sku: i.sku,
            name: i.name,
            qty_ordered: i.qty,
            unit_cost: i.unitCost,
          })),
          from_alert_id: prefill?.alertId ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create order");
        return;
      }

      toast.success(`${data.order_number as string} created${mode === "sent" ? " and sent to supplier" : ""}`);
      router.push(`/purchases/${data.id as string}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-600 text-[#1A1A17]">New purchase order</h1>
        {prefill?.alertId && (
          <p className="text-sm text-[#B47214] mt-1">Pre-filled from reorder alert</p>
        )}
      </div>

      {/* Supplier + date row */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
              Supplier
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
            >
              <option value="">— No supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
              Expected delivery
            </label>
            <input
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
              className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any instructions for the supplier…"
            className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] resize-none"
          />
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E2]">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Line items</p>
        </div>

        <div className="divide-y divide-[#E5E5E2]">
          {items.map((item, idx) => (
            <div key={idx} className="px-4 py-3 grid grid-cols-[1fr_80px_100px_80px_32px] gap-3 items-start">
              {/* Product combobox */}
              <div className="space-y-1">
                <ProductCombobox
                  products={products}
                  value={item.productId}
                  onChange={(pid) => selectProduct(idx, pid)}
                />
                {item.productId && (() => {
                  const p = productMap.get(item.productId);
                  return p ? (
                    <p className="text-[11px] text-[#6B6B66]">{p.stock_on_hand} on hand</p>
                  ) : null;
                })()}
              </div>

              {/* Qty */}
              <div>
                <label className="text-[10px] text-[#6B6B66] uppercase font-600 block mb-1">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => setItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-sm border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] tabular-nums"
                />
              </div>

              {/* Unit cost */}
              <div>
                <label className="text-[10px] text-[#6B6B66] uppercase font-600 block mb-1">Unit cost</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitCost}
                  onChange={(e) => setItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm border border-[#E5E5E2] rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] tabular-nums"
                />
              </div>

              {/* Total */}
              <div className="pt-5 text-sm tabular-nums text-right text-[#1A1A17] font-500">
                {formatCurrency(item.qty * item.unitCost)}
              </div>

              {/* Remove */}
              <div className="pt-4">
                <button
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className={cn(
                    "p-1 rounded transition-colors",
                    items.length === 1
                      ? "text-[#C8C8C4] cursor-not-allowed"
                      : "text-[#6B6B66] hover:text-[#C54632] hover:bg-[#FDF2F0]"
                  )}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add line */}
        <div className="px-4 py-3 border-t border-[#E5E5E2]">
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
          >
            <Plus size={14} />
            + Add line
          </button>
        </div>
      </div>

      {/* Break-even panel */}
      {breakEven && (
        <div className={cn(
          "rounded-lg border p-4 space-y-3",
          breakEven.riskFactor === "high"   ? "border-[#C54632]/30 bg-[#FDF2F0]"
          : breakEven.riskFactor === "medium" ? "border-[#B47214]/30 bg-[#FDF8EE]"
          : "border-[#4D7B3D]/30 bg-[#F2F8F0]"
        )}>
          <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Break-even analysis</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total cost", value: formatCurrency(breakEven.totalCost) },
              { label: "Expected revenue", value: formatCurrency(breakEven.expectedRevenue) },
              { label: "Expected profit", value: formatCurrency(breakEven.expectedProfit) },
              { label: "ROI", value: `${breakEven.expectedRoi.toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/70 rounded-md px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">{label}</p>
                <p className="text-sm font-500 text-[#1A1A17] tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#1A1A17]">
            Need to sell <strong>{breakEven.unitsToBreakEven} units</strong> to recover cost.{" "}
            {breakEven.expectedTimeToClears < Infinity
              ? <>At current sales pace: <strong>~{Math.ceil(breakEven.expectedTimeToClears)} days</strong> to sell through.</>
              : "No sales velocity data — risk unknown."}
          </p>
          {breakEven.riskFactor === "high" && (
            <p className="text-xs text-[#C54632] font-500">
              ⚠ Sell-through exceeds 90 days — high risk of dead stock.
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-[#6B6B66]">Subtotal</span>
            <span className="tabular-nums font-500 text-[#1A1A17]">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-[#6B6B66]">Shipping</span>
            <span className="tabular-nums text-[#6B6B66]">{formatCurrency(0)}</span>
          </div>
          <div className="flex items-center gap-6 text-base font-600">
            <span className="text-[#1A1A17]">Total</span>
            <span className="tabular-nums text-[#1A1A17]">{formatCurrency(subtotal)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-sm text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
          >
            Cancel
          </button>
          <Button
            variant="outline"
            onClick={() => submit("draft")}
            disabled={saving || filledItems.length === 0}
            className="border-[#E5E5E2] text-[#1A1A17] hover:bg-[#F7F7F5]"
          >
            {saving && savingMode === "draft" ? "Saving…" : "Save as draft"}
          </Button>
          <Button
            onClick={() => submit("sent")}
            disabled={saving || filledItems.length === 0}
            className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] px-6"
          >
            {saving && savingMode === "sent" ? "Sending…" : "Send to supplier"}
          </Button>
        </div>
      </div>
    </div>
  );
}

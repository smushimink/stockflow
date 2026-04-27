"use client";

import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { InlineEdit } from "@/components/shared/inline-edit";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductMetrics, DataProvenance } from "@/lib/supabase/types";

interface ProductPricingTabProps {
  product: Product;
  metrics: ProductMetrics | null;
  supplier: { name: string; lead_time_days: number; moq: number } | null;
  history: DataProvenance[];
}

const priceSchema = z
  .number()
  .min(0.01, "Must be > 0")
  .max(999999, "Too large");

export function ProductPricingTab({
  product: initialProduct,
  metrics: initialMetrics,
  supplier,
  history,
}: ProductPricingTabProps) {
  const [tab, setTab] = useState<"pricing" | "supplier" | "activity">("pricing");
  const [product, setProduct] = useState(initialProduct);
  const [metrics, setMetrics] = useState(initialMetrics);
  const supabase = createClient();

  async function saveSellPrice(value: number) {
    await supabase
      .from("products")
      .update({ selling_price: value })
      .eq("id", product.id);

    // Recalculate margin locally
    const newMargin = product.unit_cost > 0
      ? (value - product.unit_cost) / value
      : 0;

    setProduct((p) => ({ ...p, selling_price: value }));
    if (metrics) {
      setMetrics((m) => m ? { ...m, real_margin_pct: newMargin } : m);
    }
  }

  async function saveCostPrice(value: number) {
    await supabase
      .from("products")
      .update({ unit_cost: value })
      .eq("id", product.id);

    const newMargin = value > 0
      ? (product.selling_price - value) / product.selling_price
      : 0;

    setProduct((p) => ({ ...p, unit_cost: value }));
    if (metrics) {
      setMetrics((m) => m ? { ...m, real_margin_pct: newMargin } : m);
    }
  }

  async function saveReorderPoint(value: number) {
    await supabase
      .from("products")
      .update({ reorder_point: value })
      .eq("id", product.id);
    setProduct((p) => ({ ...p, reorder_point: value }));
  }

  async function saveReorderQty(value: number) {
    await supabase
      .from("products")
      .update({ reorder_qty: value })
      .eq("id", product.id);
    setProduct((p) => ({ ...p, reorder_qty: value }));
  }

  const tabs = [
    { id: "pricing", label: "Pricing" },
    { id: "supplier", label: "Supplier" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E5E5E2] px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={
              tab === t.id
                ? "px-3 py-3 text-sm font-500 text-[#1A1A17] border-b-2 border-[#1A1A17] -mb-px"
                : "px-3 py-3 text-sm text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pricing tab */}
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
                  ? `${(metrics.real_margin_pct * 100).toFixed(1)}%`
                  : "—"}
              </span>
            }
            computed
          />
          <div className="pt-3 border-t border-[#E5E5E2] mt-3">
            <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">Reorder logic</p>
          </div>
          <PricingRow
            label="Reorder point"
            value={
              <InlineEdit
                value={product.reorder_point}
                schema={z.number().int().min(0)}
                onSave={saveReorderPoint}
                suffix=" units"
              />
            }
          />
          <PricingRow
            label="Reorder quantity"
            value={
              <InlineEdit
                value={product.reorder_qty}
                schema={z.number().int().min(1)}
                onSave={saveReorderQty}
                suffix=" units"
              />
            }
          />
        </div>
      )}

      {/* Supplier tab */}
      {tab === "supplier" && (
        <div className="p-4">
          {supplier ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#6B6B66] mb-0.5">Supplier</p>
                  <p className="text-sm font-500 text-[#1A1A17]">{supplier.name}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6B66] mb-0.5">Lead time</p>
                  <p className="text-sm font-500 text-[#1A1A17]">{product.lead_time_days ?? supplier.lead_time_days} days</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6B66] mb-0.5">Min order qty</p>
                  <p className="text-sm font-500 text-[#1A1A17]">{product.moq ?? supplier.moq} units</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B6B66]">No supplier linked.</p>
          )}
        </div>
      )}

      {/* Activity tab */}
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

function PricingRow({ label, value, computed }: { label: string; value: React.ReactNode; computed?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${computed ? "text-[#6B6B66]" : "text-[#1A1A17]"}`}>{label}</span>
      {value}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AlertWithProduct } from "@/lib/decisions/types";

interface Supplier {
  id: string;
  name: string;
  lead_time_days: number;
}

interface QuickPoSheetProps {
  alert: AlertWithProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickPoSheet({ alert, open, onOpenChange }: QuickPoSheetProps) {
  const router = useRouter();

  const meta = alert.metadata as Record<string, unknown>;
  const product = Array.isArray(alert.products) ? alert.products?.[0] : alert.products;

  // Pre-fill from alert metadata
  const defaultSupplierId =
    (meta.supplier_id as string | null) ??
    (product as { supplier_id?: string | null } | null)?.supplier_id ??
    "";
  const defaultQty = (meta.suggested_qty as number | null) ?? (meta.moq as number | null) ?? 1;
  const defaultUnitCost = (product as { unit_cost?: number } | null)?.unit_cost ?? 0;
  const productName = (product as { name?: string } | null)?.name ?? alert.title;
  const productSku = (product as { sku?: string } | null)?.sku ?? "";
  const productId = alert.related_product_id;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [qty, setQty] = useState(defaultQty);
  const [unitCost, setUnitCost] = useState(defaultUnitCost);
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<"draft" | "sent">("draft");

  // Load suppliers when sheet opens
  useEffect(() => {
    if (!open) return;
    setLoadingSuppliers(true);
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((data: Supplier[]) => {
        setSuppliers(data);
        // Re-apply default supplier_id after load (may have been cleared)
        if (!supplierId && defaultSupplierId) setSupplierId(defaultSupplierId);
      })
      .catch(() => toast.error("Failed to load suppliers"))
      .finally(() => setLoadingSuppliers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = qty * unitCost;

  async function submit(mode: "draft" | "sent") {
    setSaveMode(mode);
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
          from_alert_id: alert.id,
          items: [
            {
              product_id: productId ?? null,
              sku: productSku || "—",
              name: productName,
              qty_ordered: qty,
              unit_cost: unitCost,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create order");
        return;
      }

      toast.success(
        `${data.order_number as string} created${mode === "sent" ? " — sent to supplier" : ""}`
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] bg-white p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-[#E5E5E2]">
          <SheetTitle className="text-base font-600 text-[#1A1A17]">Quick purchase order</SheetTitle>
          <p className="text-xs text-[#B47214] mt-0.5">Pre-filled from reorder alert</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Product row */}
          <div className="bg-[#F7F7F5] border border-[#E5E5E2] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] mb-1">Product</p>
            <p className="text-sm font-500 text-[#1A1A17]">{productName}</p>
            {productSku && <p className="text-xs text-[#6B6B66] mt-0.5">{productSku}</p>}
          </div>

          {/* Supplier */}
          <div>
            <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
              Supplier
            </label>
            {loadingSuppliers ? (
              <div className="text-xs text-[#6B6B66]">Loading…</div>
            ) : (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
              >
                <option value="">— No supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.lead_time_days ? `(${s.lead_time_days}d lead)` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Qty + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider block mb-1.5">
                Unit cost
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full text-sm border border-[#E5E5E2] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17] tabular-nums"
              />
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-2 border-t border-[#E5E5E2]">
            <span className="text-sm text-[#6B6B66]">Total</span>
            <span className="text-lg font-600 tabular-nums text-[#1A1A17]">{formatCurrency(total)}</span>
          </div>

          {/* Expected date */}
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

          {/* Notes */}
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

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E5E5E2] flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 border-[#E5E5E2] text-[#1A1A17]"
            onClick={() => submit("draft")}
            disabled={saving}
          >
            {saving && saveMode === "draft" ? "Saving…" : "Save draft"}
          </Button>
          <Button
            className="flex-1 bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
            onClick={() => submit("sent")}
            disabled={saving}
          >
            {saving && saveMode === "sent" ? "Sending…" : "Send now"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  draft:     { label: "Draft",     dot: "bg-[#C8C8C4]", text: "text-[#6B6B66]",  bg: "bg-[#F7F7F5]" },
  sent:      { label: "Sent",      dot: "bg-[#3B6BB4]",  text: "text-[#3B6BB4]", bg: "bg-[#EEF3FB]" },
  confirmed: { label: "Confirmed", dot: "bg-[#B47214]",  text: "text-[#B47214]", bg: "bg-[#FDF8EE]" },
  received:  { label: "Received",  dot: "bg-[#4D7B3D]",  text: "text-[#4D7B3D]", bg: "bg-[#F2F8F0]" },
  cancelled: { label: "Cancelled", dot: "bg-[#C54632]",  text: "text-[#C54632]", bg: "bg-[#FDF2F0]" },
};

const STEPS = ["draft", "sent", "confirmed", "received"] as const;

interface PoItem {
  id: string;
  product_id: string | null;
  sku: string;
  name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  total: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  contact_name: string | null;
  lead_time_days: number;
}

interface Po {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  expected_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  supplier_id: string | null;
  suppliers: Supplier | Supplier[] | null;
}

interface PoDetailProps {
  po: Po;
  items: PoItem[];
}

export function PoDetail({ po: initialPo, items: initialItems }: PoDetailProps) {
  const router = useRouter();
  const [po, setPo] = useState(initialPo);
  const [items] = useState(initialItems);
  const [transitioning, setTransitioning] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.qty_ordered - i.qty_received]))
  );
  const [receiving, setReceiving] = useState(false);

  const sc = statusConfig[po.status] ?? statusConfig.draft;
  const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
  const stepIdx = STEPS.indexOf(po.status as typeof STEPS[number]);

  async function transition(newStatus: string) {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      setPo((prev) => ({ ...prev, status: newStatus }));
      toast.success(`Order ${sc.label.toLowerCase()} → ${statusConfig[newStatus]?.label ?? newStatus}`);
      if (newStatus === "received") router.refresh();
    } finally {
      setTransitioning(false);
    }
  }

  async function confirmReceive() {
    setReceiving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            item_id: i.id,
            qty_received: receiveQtys[i.id] ?? i.qty_ordered,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to mark received");
        return;
      }
      toast.success("Stock updated — order marked as received");
      setPo((prev) => ({ ...prev, status: "received" }));
      setShowReceive(false);
      router.refresh();
    } finally {
      setReceiving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/purchases"
          className="flex items-center gap-1.5 text-xs text-[#6B6B66] hover:text-[#1A1A17] mb-3 transition-colors"
        >
          <ChevronLeft size={12} />
          Purchase orders
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-600 text-[#1A1A17]">{po.order_number}</h1>
              <span className={cn("flex items-center gap-1.5 text-xs font-500 px-2 py-1 rounded-full", sc.bg, sc.text)}>
                <div className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                {sc.label}
              </span>
            </div>
            {supplier && (
              <p className="text-sm text-[#6B6B66] mt-0.5">{supplier.name}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {po.status === "draft" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => transition("cancelled")}
                  disabled={transitioning}
                >
                  Cancel order
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1A1A17] text-white text-xs"
                  onClick={() => transition("sent")}
                  disabled={transitioning}
                >
                  {transitioning ? "…" : "Send to supplier"}
                </Button>
              </>
            )}
            {po.status === "sent" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => transition("cancelled")}
                  disabled={transitioning}
                >
                  Cancel order
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1A1A17] text-white text-xs"
                  onClick={() => transition("confirmed")}
                  disabled={transitioning}
                >
                  {transitioning ? "…" : "Mark confirmed"}
                </Button>
              </>
            )}
            {po.status === "confirmed" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => transition("cancelled")}
                  disabled={transitioning}
                >
                  Cancel order
                </Button>
                <Button
                  size="sm"
                  className="bg-[#4D7B3D] text-white hover:bg-[#3d6230] text-xs"
                  onClick={() => setShowReceive(true)}
                  disabled={transitioning}
                >
                  Mark as received
                </Button>
              </>
            )}
            {po.status === "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => transition("draft")}
                disabled={transitioning}
              >
                Reopen as draft
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status timeline */}
      {po.status !== "cancelled" && (
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const past = stepIdx > i;
            const current = stepIdx === i;
            const sc2 = statusConfig[step];
            return (
              <div key={step} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-1.5 text-xs font-500 transition-colors",
                  past || current ? sc2.text : "text-[#C8C8C4]"
                )}>
                  {past ? (
                    <CheckCircle size={14} className="text-[#4D7B3D]" />
                  ) : (
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 transition-colors",
                      current ? `border-current bg-current` : "border-[#E5E5E2]"
                    )} />
                  )}
                  {sc2.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px mx-2", past ? "bg-[#4D7B3D]" : "bg-[#E5E5E2]")} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Receive form */}
      {showReceive && (
        <div className="bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded-lg p-4 space-y-3">
          <p className="text-sm font-600 text-[#1A1A17]">Confirm receipt — enter quantities received</p>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-500 text-[#1A1A17]">{item.sku}</span>
                  <span className="text-xs text-[#6B6B66] ml-2 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#6B6B66]">Ordered: {item.qty_ordered}</span>
                  <input
                    type="number"
                    min={0}
                    max={item.qty_ordered}
                    value={receiveQtys[item.id] ?? item.qty_ordered}
                    onChange={(e) =>
                      setReceiveQtys((prev) => ({
                        ...prev,
                        [item.id]: Math.min(item.qty_ordered, Math.max(0, parseInt(e.target.value) || 0)),
                      }))
                    }
                    className="w-20 text-sm border border-[#4D7B3D]/40 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#4D7B3D] tabular-nums text-center"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              className="bg-[#4D7B3D] text-white hover:bg-[#3d6230] text-xs"
              onClick={confirmReceive}
              disabled={receiving}
            >
              {receiving ? "Updating stock…" : "Confirm receipt + update stock"}
            </Button>
            <button
              onClick={() => setShowReceive(false)}
              className="text-xs text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetaCell label="Created" value={new Date(po.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} />
        <MetaCell
          label="Expected"
          value={po.expected_at ? new Date(po.expected_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        />
        <MetaCell
          label="Received"
          value={po.received_at ? new Date(po.received_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        />
      </div>

      {/* Items table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E2]">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Items</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E2]">
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
              <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Product</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Ordered</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Received</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Unit cost</th>
              <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E2]">
            {items.map((item) => {
              const fully = item.qty_received >= item.qty_ordered && item.qty_ordered > 0;
              const partial = item.qty_received > 0 && !fully;
              return (
                <tr key={item.id} className="hover:bg-[#F7F7F5]">
                  <td className="px-4 py-3 font-500 text-[#1A1A17]">{item.sku}</td>
                  <td className="px-4 py-3 text-[#6B6B66]">{item.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qty_ordered}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={cn(
                      fully ? "text-[#4D7B3D] font-500" : partial ? "text-[#B47214]" : "text-[#6B6B66]"
                    )}>
                      {item.qty_received}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#6B6B66]">{formatCurrency(item.unit_cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-500 text-[#1A1A17]">{formatCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#E5E5E2] bg-[#F7F7F5]">
              <td colSpan={5} className="px-4 py-3 text-right text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-600 text-[#1A1A17]">{formatCurrency(po.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-1.5">Notes</p>
          <p className="text-sm text-[#1A1A17] whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      {/* Supplier info */}
      {supplier && (
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider mb-2">Supplier</p>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-500 text-[#1A1A17]">{supplier.name}</p>
              {supplier.contact_name && <p className="text-xs text-[#6B6B66] mt-0.5">{supplier.contact_name}</p>}
              {supplier.contact_email && (
                <a href={`mailto:${supplier.contact_email}`} className="text-xs text-[#3B6BB4] hover:underline mt-0.5 block">
                  {supplier.contact_email}
                </a>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-[#6B6B66]">Lead time</p>
              <p className="text-sm font-500 text-[#1A1A17]">{supplier.lead_time_days}d</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">{label}</p>
      <p className="text-sm font-500 text-[#1A1A17] mt-0.5">{value}</p>
    </div>
  );
}

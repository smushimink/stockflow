"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { DeadProduct } from "@/app/(dashboard)/insights/dead-stock/page";

const SEVERITY_META = {
  red: {
    label: "Critical (180+ days)",
    dot: "bg-[#C54632]",
    text: "text-[#C54632]",
    bg: "bg-[#FDF2F0]",
    border: "border-[#C54632]/20",
    header: "text-[#C54632]",
  },
  orange: {
    label: "Warning (90–180 days)",
    dot: "bg-[#B47214]",
    text: "text-[#B47214]",
    bg: "bg-[#FDF8EE]",
    border: "border-[#B47214]/20",
    header: "text-[#B47214]",
  },
  yellow: {
    label: "Watch (60–90 days)",
    dot: "bg-[#D4A22B]",
    text: "text-[#D4A22B]",
    bg: "bg-white",
    border: "border-[#E5E5E2]",
    header: "text-[#B47214]",
  },
} as const;

interface Props {
  products: DeadProduct[];
  hasMetrics: boolean;
}

export function DeadStockClient({ products, hasMetrics }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const totalCashTiedUp = products.reduce((s, p) => s + p.cashTiedUp, 0);
  const grouped = {
    red: products.filter((p) => p.severity === "red"),
    orange: products.filter((p) => p.severity === "orange"),
    yellow: products.filter((p) => p.severity === "yellow"),
  };

  function toggleAll(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkAction(action: "discount50" | "discontinue") {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selected], action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Action failed");
        return;
      }
      toast.success(
        action === "discount50"
          ? `Applied 50% discount to ${data.updated as number} products`
          : `Marked ${data.updated as number} products as discontinued`
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        <KpiRow products={[]} totalCash={0} hasMetrics={hasMetrics} />
        <div className="bg-white border border-[#E5E5E2] rounded-lg py-16 text-center">
          <p className="text-sm font-500 text-[#1A1A17]">No dead stock detected</p>
          <p className="text-xs text-[#6B6B66] mt-1">
            All stocked products have had a sale in the last 90 days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <KpiRow products={products} totalCash={totalCashTiedUp} hasMetrics={hasMetrics} />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[#1A1A17] text-white text-sm px-4 py-3 rounded-lg">
          <span className="font-500">{selected.size} selected</span>
          <span className="text-white/40">·</span>
          <button
            onClick={() => bulkAction("discount50")}
            disabled={busy}
            className="text-sm hover:text-white/80 transition-colors disabled:opacity-50"
          >
            Apply 50% discount
          </button>
          <button
            onClick={() => bulkAction("discontinue")}
            disabled={busy}
            className="text-sm text-[#F87171] hover:text-[#F87171]/80 transition-colors disabled:opacity-50"
          >
            Mark for liquidation
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-white/50 hover:text-white/80"
          >
            Clear
          </button>
        </div>
      )}

      {/* Grouped tables */}
      {(["red", "orange", "yellow"] as const).map((sev) => {
        const rows = grouped[sev];
        if (rows.length === 0) return null;
        const meta = SEVERITY_META[sev];
        const groupIds = rows.map((p) => p.id);
        const allGroupSelected = groupIds.every((id) => selected.has(id));

        return (
          <div key={sev} className={cn("rounded-lg border overflow-hidden", meta.border)}>
            {/* Group header */}
            <div className={cn("px-4 py-3 border-b flex items-center justify-between", meta.bg, meta.border)}>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allGroupSelected}
                  onChange={() => toggleAll(groupIds)}
                  className="rounded border-[#C8C8C4] cursor-pointer"
                />
                <div className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
                <p className={cn("text-xs font-600 uppercase tracking-wider", meta.header)}>
                  {meta.label}
                </p>
                <span className={cn("text-xs ml-1", meta.text)}>{rows.length} products</span>
              </div>
              <span className="text-xs tabular-nums font-500 text-[#1A1A17]">
                {formatCurrency(rows.reduce((s, p) => s + p.cashTiedUp, 0))} tied up
              </span>
            </div>

            <table className="w-full text-sm bg-white">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="w-10 px-4 py-2"></th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Stock</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Days idle</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Unit cost</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Cash tied</th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">50% price</th>
                  <th className="px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {rows.map((p) => (
                  <tr key={p.id} className={cn("hover:bg-[#F7F7F5]", selected.has(p.id) && "bg-[#F7F7F5]")}>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        className="rounded border-[#C8C8C4] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-500 text-[#1A1A17] text-xs tabular-nums">{p.sku}</td>
                    <td className="px-4 py-2.5 text-[#1A1A17] max-w-[160px] truncate">{p.name}</td>
                    <td className="px-4 py-2.5 text-[#6B6B66] text-xs">{p.category ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">{p.stockOnHand}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums text-xs font-500", meta.text)}>
                      {p.daysSinceLastSale !== null ? `${p.daysSinceLastSale}d` : "Never"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                      {formatCurrency(p.unitCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">
                      {formatCurrency(p.cashTiedUp)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                      {formatCurrency(p.sellingPrice * 0.5)}
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
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function KpiRow({
  products,
  totalCash,
  hasMetrics,
}: {
  products: DeadProduct[];
  totalCash: number;
  hasMetrics: boolean;
}) {
  const critical = products.filter((p) => p.severity === "red").length;
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Dead stock items</p>
        <p className={cn("text-2xl font-600 tabular-nums mt-2", products.length > 0 ? "text-[#C54632]" : "text-[#1A1A17]")}>
          {products.length}
        </p>
      </div>
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Cash tied up</p>
        <p className={cn("text-2xl font-600 tabular-nums mt-2", totalCash > 0 ? "text-[#B47214]" : "text-[#1A1A17]")}>
          {formatCurrency(totalCash)}
        </p>
      </div>
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Critical (180d+)</p>
        <p className={cn("text-2xl font-600 tabular-nums mt-2", critical > 0 ? "text-[#C54632]" : "text-[#1A1A17]")}>
          {critical}
        </p>
      </div>
      <div className="bg-white border border-[#E5E5E2] rounded-lg p-4">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Detection</p>
        <p className="text-sm font-600 mt-2 text-[#1A1A17]">{hasMetrics ? "Product metrics" : "Order history"}</p>
        {!hasMetrics && <p className="text-xs text-[#6B6B66] mt-0.5">Run engine for precise data</p>}
      </div>
    </div>
  );
}

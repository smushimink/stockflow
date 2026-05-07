"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { addCustomerNote, markCustomerContacted } from "@/app/(dashboard)/customers/actions";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/lib/supabase/types";
import type { CustomerOrder, ChurnAlertData } from "@/app/(dashboard)/customers/[id]/page";
import { CustomerProfitDeepDive } from "@/components/customers/customer-profitability-deep-dive";
import type { ProfitDeepDiveData } from "@/components/customers/customer-profitability-deep-dive";

interface Props {
  customer: Customer;
  orders: CustomerOrder[];
  churnAlert: ChurnAlertData | null;
  deepDive: ProfitDeepDiveData;
}

export function CustomerDetailClient({
  customer: initial,
  orders,
  churnAlert: initialAlert,
  deepDive,
}: Props) {
  const [customer, setCustomer] = useState(initial);
  const [alert, setAlert] = useState(initialAlert);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacting, setContacting] = useState(false);

  // Compute top 5 products by qty across all orders
  const productMap = new Map<
    string,
    { sku: string; name: string; qty: number; revenue: number; profit: number }
  >();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.product_id ?? item.sku;
      const itemProfit = item.qty * item.unit_price - item.qty * item.unit_cost - item.discount;
      const existing = productMap.get(key);
      if (existing) {
        existing.qty += item.qty;
        existing.revenue += item.total;
        existing.profit += itemProfit;
      } else {
        productMap.set(key, {
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          revenue: item.total,
          profit: itemProfit,
        });
      }
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Profit from order items (computed locally as fallback if DB columns missing)
  const computedProfit = orders.reduce((sum, o) =>
    sum + o.items.reduce((s, i) => s + (i.qty * i.unit_price - i.qty * i.unit_cost - i.discount), 0), 0
  );
  // Use DB value if available (populated after migration + recalculate)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lifetimeProfit = ((customer as any).gross_profit_lifetime as number | null) ?? computedProfit;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profit90d = ((customer as any).gross_profit_90d as number | null) ?? 0;
  const profitMargin = customer.total_spent > 0 ? lifetimeProfit / customer.total_spent : 0;
  const profitPerOrder = customer.total_orders > 0 ? lifetimeProfit / customer.total_orders : 0;
  const isLowMarginHighValue = profitMargin < 0.15 && customer.total_spent > 5000;

  // Parse append-only notes (split on \n---\n separator, newest first)
  const noteEntries = customer.notes
    ? customer.notes.split("\n---\n").filter(Boolean).reverse()
    : [];

  const avgOrderValue =
    customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0;

  function toggleOrder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function appendLocal(text: string) {
    const ts = new Date().toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const entry = `[${ts}] ${text}`;
    const updated = customer.notes ? customer.notes + "\n---\n" + entry : entry;
    setCustomer((c) => ({ ...c, notes: updated }));
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addCustomerNote(customer.id, noteText.trim());
      appendLocal(noteText.trim());
      setNoteText("");
      toast.success("Note saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkContacted() {
    setContacting(true);
    try {
      await markCustomerContacted(customer.id);
      appendLocal("Marked as contacted");
      setAlert(null);
      toast.success("Marked as contacted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setContacting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#6B6B66]">
        <Link href="/customers" className="hover:text-[#1A1A17]">
          Customers
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#1A1A17] font-500">{customer.name}</span>
      </nav>

      {/* Churn banner */}
      {alert && (
        <div className="flex items-center justify-between gap-4 bg-[#FDF2F0] border border-[#C54632]/20 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#C54632] mt-1 shrink-0" />
            <div>
              <p className="text-sm font-600 text-[#C54632]">Customer at risk</p>
              <p className="text-xs text-[#6B6B66] mt-0.5">{alert.summary}</p>
            </div>
          </div>
          <button
            onClick={handleMarkContacted}
            disabled={contacting}
            className="shrink-0 text-xs font-500 px-3 py-1.5 rounded-lg bg-[#C54632] text-white hover:bg-[#A83928] transition-colors disabled:opacity-50"
          >
            {contacting ? "Saving…" : "Mark contacted"}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-600 text-[#1A1A17]">{customer.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {customer.company && (
              <span className="text-sm text-[#6B6B66]">{customer.company}</span>
            )}
            {customer.email && (
              <>
                {customer.company && <span className="text-[#E5E5E2]">·</span>}
                <a
                  href={`mailto:${customer.email}`}
                  className="text-sm text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
                >
                  {customer.email}
                </a>
              </>
            )}
            {customer.phone && (
              <>
                <span className="text-[#E5E5E2]">·</span>
                <span className="text-sm text-[#6B6B66]">{customer.phone}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleMarkContacted}
          disabled={contacting}
          className="shrink-0 text-sm font-500 px-4 py-2 rounded-lg bg-[#1A1A17] text-white hover:bg-[#2D2D29] transition-colors disabled:opacity-50"
        >
          {contacting ? "Saving…" : "Mark contacted"}
        </button>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Lifetime spend" value={formatCurrency(customer.total_spent)} />
        <KpiCard label="Total orders" value={String(customer.total_orders)} />
        <KpiCard
          label="Avg order value"
          value={avgOrderValue > 0 ? formatCurrency(avgOrderValue) : "—"}
        />
      </div>

      {/* Profit section — deep dive */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
            Profitability
          </h2>
          <div className="flex items-center gap-4 text-sm tabular-nums">
            <span className="text-[#6B6B66]">
              Lifetime profit:{" "}
              <span
                className="font-600"
                style={{ color: lifetimeProfit >= 0 ? "#1A1A17" : "#C54632" }}
              >
                {formatCurrency(lifetimeProfit)}
              </span>
            </span>
            <span
              className="font-600"
              style={{
                color:
                  profitMargin >= 0.25 ? "#4D7B3D" : profitMargin >= 0.15 ? "#B47214" : "#C54632",
              }}
            >
              {profitMargin > 0 ? `${(profitMargin * 100).toFixed(1)}%` : "—"} margin
            </span>
          </div>
        </div>

        {isLowMarginHighValue && (
          <div className="bg-[#FDF8EE] border border-[#B47214]/20 rounded-lg px-4 py-3 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[#B47214] mt-1 shrink-0" />
            <p className="text-sm text-[#1A1A17]">
              Consider renegotiating pricing —{" "}
              <span className="font-500">
                only {(profitMargin * 100).toFixed(1)}% margin on{" "}
                {formatCurrency(customer.total_spent)} lifetime revenue.
              </span>
            </p>
          </div>
        )}

        <CustomerProfitDeepDive
          orders={orders}
          deepDive={deepDive}
          customerTotalSpent={customer.total_spent as number}
        />
      </section>

      {/* Order timeline */}
      <section className="space-y-2">
        <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
          Order timeline
          <span className="ml-2 font-400 normal-case text-[#C8C8C4]">
            {orders.length} orders
          </span>
        </h2>
        {orders.length === 0 ? (
          <div className="bg-white border border-[#E5E5E2] rounded-lg py-10 text-center text-sm text-[#6B6B66]">
            No orders yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {orders.map((order) => {
              const isExpanded = expanded.has(order.id);
              return (
                <div
                  key={order.id}
                  className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleOrder(order.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F7F7F5] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <ChevronRight
                        size={13}
                        className={cn(
                          "text-[#C8C8C4] transition-transform shrink-0",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <div>
                        <p className="text-sm font-500 text-[#1A1A17]">{order.order_number}</p>
                        <p className="text-xs text-[#6B6B66] mt-0.5">
                          {new Date(order.ordered_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-600 tabular-nums text-[#1A1A17] shrink-0">
                      {formatCurrency(order.total)}
                    </p>
                  </button>

                  {isExpanded && order.items.length > 0 && (
                    <div className="border-t border-[#E5E5E2] bg-[#F7F7F5] divide-y divide-[#F0F0EE]">
                      {order.items.map((item) => (
                        <div key={item.id} className="px-6 py-2 flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-xs font-500 text-[#1A1A17] mr-2">
                              {item.sku}
                            </span>
                            <span className="text-xs text-[#6B6B66] truncate">{item.name}</span>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-xs text-[#6B6B66] tabular-nums">
                              {item.qty} × {formatCurrency(item.unit_price)}
                            </p>
                            <p className="text-xs font-500 text-[#1A1A17] tabular-nums">
                              {formatCurrency(item.total)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top products */}
      {topProducts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
            Top products bought
          </h2>
          <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                    Product
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                    Units
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {topProducts.map((p, i) => (
                  <tr key={p.sku} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-2.5 text-xs font-500 text-[#1A1A17]">
                      <span className="text-[#C8C8C4] mr-1.5 tabular-nums">{i + 1}.</span>
                      {p.sku}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6B6B66] max-w-[200px] truncate">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-500 text-[#1A1A17]">
                      {p.qty}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#6B6B66]">
                      {formatCurrency(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Activity & notes */}
      <section className="space-y-3">
        <h2 className="text-sm font-600 text-[#6B6B66] uppercase tracking-wider">
          Activity &amp; notes
        </h2>

        {/* Add note input */}
        <div className="bg-white border border-[#E5E5E2] rounded-lg p-4 space-y-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
            }}
            rows={2}
            placeholder="Add a note… (⌘↵ to save)"
            className="w-full text-sm text-[#1A1A17] border border-[#E5E5E2] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A1A17] transition-colors placeholder:text-[#C8C8C4]"
          />
          <div className="flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={saving || !noteText.trim()}
              className="text-xs font-500 px-3 py-1.5 rounded-lg bg-[#1A1A17] text-white hover:bg-[#2D2D29] transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>

        {/* Note entries — newest first */}
        {noteEntries.length > 0 ? (
          <div className="space-y-1.5">
            {noteEntries.map((entry, i) => {
              const match = entry.match(/^\[([^\]]+)\]\s*([\s\S]+)$/);
              const timestamp = match?.[1] ?? "";
              const body = match?.[2] ?? entry;
              const isContacted = body.trim() === "Marked as contacted";
              return (
                <div
                  key={i}
                  className={cn(
                    "bg-white border rounded-lg px-4 py-3",
                    isContacted ? "border-[#4D7B3D]/20 bg-[#F2F8F0]" : "border-[#E5E5E2]"
                  )}
                >
                  {timestamp && (
                    <p className="text-[10px] text-[#C8C8C4] mb-1">{timestamp}</p>
                  )}
                  <p
                    className={cn(
                      "text-sm whitespace-pre-wrap",
                      isContacted ? "text-[#4D7B3D] font-500" : "text-[#1A1A17]"
                    )}
                  >
                    {body.trim()}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-[#E5E5E2] rounded-lg py-8 text-center text-xs text-[#6B6B66]">
            No activity logged yet.
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className="text-lg font-600 tabular-nums" style={{ color: color ?? "#1A1A17" }}>
        {value}
      </p>
    </div>
  );
}

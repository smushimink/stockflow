"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MarketSignal } from "@/lib/decisions/types";
import {
  upsertFxRate,
  upsertCategoryTrend,
  addManualNote,
  deleteSignal,
} from "@/app/(dashboard)/insights/market/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForeignCurrency {
  currency: string;
  supplierNames: string[];
}

interface Props {
  primaryCurrency: string;
  foreignCurrencies: ForeignCurrency[];
  categories: string[];
  signals: MarketSignal[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOTE_TAGS = [
  "supplier_change",
  "competitor_action",
  "regulation",
  "weather",
  "holiday",
  "other",
] as const;

type NoteTag = (typeof NOTE_TAGS)[number];

function getActiveFxSignal(
  signals: MarketSignal[],
  fromCurrency: string,
  toCurrency: string
): (MarketSignal & { value: { from_currency: string; to_currency: string; rate: number; prior_rate: number } }) | null {
  return (
    signals.find(
      (s) =>
        s.signal_type === "fx_rate" &&
        (s.value as { from_currency?: string }).from_currency === fromCurrency &&
        (s.value as { to_currency?: string }).to_currency === toCurrency
    ) as (MarketSignal & { value: { from_currency: string; to_currency: string; rate: number; prior_rate: number } }) | undefined
  ) ?? null;
}

function getActiveCategoryTrend(
  signals: MarketSignal[],
  category: string
): "rising" | "stable" | "declining" | null {
  const sig = signals.find(
    (s) =>
      s.signal_type === "category_trend" &&
      (s.value as { category?: string }).category?.toLowerCase() === category.toLowerCase()
  );
  return (sig?.value as { trend?: string })?.trend as "rising" | "stable" | "declining" | null ?? null;
}

// ── FX section ────────────────────────────────────────────────────────────────

function FxRow({
  fc,
  primaryCurrency,
  signals,
}: {
  fc: ForeignCurrency;
  primaryCurrency: string;
  signals: MarketSignal[];
}) {
  const [isPending, startTransition] = useTransition();
  const existing = getActiveFxSignal(signals, fc.currency, primaryCurrency);

  const [rate, setRate] = useState(existing?.value.rate?.toString() ?? "");
  const [prior, setPrior] = useState(existing?.value.prior_rate?.toString() ?? "");
  const [open, setOpen] = useState(false);

  const shift =
    existing && existing.value.prior_rate !== 0
      ? ((existing.value.rate - existing.value.prior_rate) / existing.value.prior_rate) * 100
      : null;

  function handleSave() {
    const r = parseFloat(rate);
    const p = parseFloat(prior);
    if (isNaN(r) || isNaN(p) || r <= 0 || p <= 0) {
      toast.error("Enter valid positive rates");
      return;
    }
    startTransition(async () => {
      const result = await upsertFxRate(fc.currency, primaryCurrency, r, p);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`FX rate updated: ${fc.currency}/${primaryCurrency} = ${r}`);
        setOpen(false);
      }
    });
  }

  async function handleDelete() {
    if (!existing) return;
    startTransition(async () => {
      const result = await deleteSignal(existing.id);
      if (result.error) toast.error(result.error);
      else toast.success("FX rate removed");
    });
  }

  return (
    <div className="rounded-xl border border-[#E5E5E2] bg-white px-4 py-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-500 text-[#1A1A17]">
            {fc.currency} / {primaryCurrency}
          </p>
          <p className="text-xs text-[#6B6B66]">
            Suppliers: {fc.supplierNames.slice(0, 3).join(", ")}
            {fc.supplierNames.length > 3 ? ` +${fc.supplierNames.length - 3} more` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {existing && (
            <div className="text-right">
              <p className="text-sm font-500 text-[#1A1A17]">
                1 {fc.currency} = {existing.value.rate} {primaryCurrency}
              </p>
              {shift !== null && (
                <p
                  className={cn(
                    "text-xs font-500",
                    shift > 0
                      ? "text-[#DC2626]"   // cost rose
                      : shift < 0
                      ? "text-[#4D7B3D]"   // cost fell
                      : "text-[#6B6B66]"
                  )}
                >
                  Cost impact: {shift > 0 ? "+" : ""}{shift.toFixed(1)}% from FX shift
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 rounded-lg text-xs font-500 bg-[#F7F7F5] text-[#1A1A17] hover:bg-[#F0F0EE] transition-colors"
          >
            {existing ? "Update" : "Set rate"}
          </button>
          {existing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-2 py-1.5 rounded-lg text-xs text-[#6B6B66] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="pt-1 flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-[#6B6B66] uppercase tracking-wider">
              Current rate (1 {fc.currency} in {primaryCurrency})
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 0.21"
              className="w-28 rounded-lg border border-[#E5E5E2] px-3 py-1.5 text-sm text-[#1A1A17] focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#6B6B66] uppercase tracking-wider">
              Prior rate
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={prior}
              onChange={(e) => setPrior(e.target.value)}
              placeholder="e.g. 0.20"
              className="w-28 rounded-lg border border-[#E5E5E2] px-3 py-1.5 text-sm text-[#1A1A17] focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-1.5 rounded-lg bg-[#1A1A17] text-white text-xs font-500 hover:bg-[#2D2D29] disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-lg text-xs text-[#6B6B66] hover:bg-[#F7F7F5] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Category trend section ────────────────────────────────────────────────────

const TREND_OPTIONS = [
  { value: "rising",    label: "Rising",    color: "text-[#4D7B3D] bg-[#F2F8F0] border-[#C5DFC0]" },
  { value: "stable",    label: "Stable",    color: "text-[#6B6B66] bg-[#F7F7F5] border-[#E5E5E2]" },
  { value: "declining", label: "Declining", color: "text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]" },
] as const;

function CategoryTrendRow({
  category,
  signals,
}: {
  category: string;
  signals: MarketSignal[];
}) {
  const [isPending, startTransition] = useTransition();
  const current = getActiveCategoryTrend(signals, category);

  function handleSet(trend: "rising" | "stable" | "declining") {
    startTransition(async () => {
      const result = await upsertCategoryTrend(category, trend);
      if (result.error) toast.error(result.error);
      else toast.success(`${category}: trend set to ${trend}`);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E5E5E2] bg-white px-4 py-3">
      <p className="text-sm font-500 text-[#1A1A17] capitalize">{category}</p>
      <div className="flex items-center gap-1.5">
        {TREND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSet(opt.value)}
            disabled={isPending}
            className={cn(
              "px-2.5 py-1 rounded-lg border text-xs font-500 transition-colors disabled:opacity-50",
              current === opt.value
                ? opt.color
                : "bg-white border-[#E5E5E2] text-[#6B6B66] hover:bg-[#F7F7F5]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Manual notes section ──────────────────────────────────────────────────────

function ManualNotesSection({ signals }: { signals: MarketSignal[] }) {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<NoteTag[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const notes = signals.filter((s) => s.signal_type === "manual_note");

  function toggleTag(tag: NoteTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleAdd() {
    if (!text.trim()) {
      toast.error("Note text is required");
      return;
    }
    startTransition(async () => {
      const result = await addManualNote(text, selectedTags, date);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Note added");
        setText("");
        setSelectedTags([]);
        setDate(new Date().toISOString().split("T")[0]);
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSignal(id);
      if (result.error) toast.error(result.error);
      else toast.success("Note deleted");
    });
  }

  return (
    <div className="space-y-3">
      {/* Add note form */}
      <div className="rounded-xl border border-[#E5E5E2] bg-white p-4 space-y-3">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Add note</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Supplier X raised prices by 8% citing input costs"
          rows={2}
          className="w-full rounded-lg border border-[#E5E5E2] px-3 py-2 text-sm text-[#1A1A17] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20"
        />
        <div className="flex flex-wrap gap-1.5">
          {NOTE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "px-2.5 py-1 rounded-full border text-xs font-500 transition-colors",
                selectedTags.includes(tag)
                  ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                  : "bg-white border-[#E5E5E2] text-[#6B6B66] hover:bg-[#F7F7F5]"
              )}
            >
              {tag.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[#E5E5E2] px-3 py-1.5 text-sm text-[#1A1A17] focus:outline-none focus:ring-2 focus:ring-[#1A1A17]/20"
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !text.trim()}
            className="px-4 py-1.5 rounded-lg bg-[#1A1A17] text-white text-xs font-500 hover:bg-[#2D2D29] disabled:opacity-50 transition-colors"
          >
            {isPending ? "Adding…" : "Add note"}
          </button>
        </div>
      </div>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) => {
            const v = note.value as { tags?: string[]; text?: string };
            return (
              <div
                key={note.id}
                className="flex items-start justify-between rounded-xl border border-[#E5E5E2] bg-white px-4 py-3 gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-sm text-[#1A1A17]">{v.text}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#6B6B66]">{note.effective_from}</span>
                    {(v.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-500 bg-[#F7F7F5] text-[#6B6B66]"
                      >
                        {tag.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={isPending}
                  className="text-[#C8C8C4] hover:text-[#DC2626] transition-colors text-lg leading-none flex-shrink-0 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketClient({
  primaryCurrency,
  foreignCurrencies,
  categories,
  signals,
}: Props) {
  return (
    <div className="space-y-10">

      {/* Currency exposure */}
      <section className="space-y-3">
        <div>
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Currency exposure</p>
          <p className="text-xs text-[#6B6B66] mt-0.5">
            Your base currency is <strong className="text-[#1A1A17]">{primaryCurrency}</strong>. Foreign-currency suppliers introduce FX risk on import costs.
          </p>
        </div>

        {foreignCurrencies.length === 0 ? (
          <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-5 text-center">
            <p className="text-sm text-[#6B6B66]">
              All active suppliers invoice in {primaryCurrency} — no FX exposure detected.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {foreignCurrencies.map((fc) => (
              <FxRow
                key={fc.currency}
                fc={fc}
                primaryCurrency={primaryCurrency}
                signals={signals}
              />
            ))}
          </div>
        )}
      </section>

      {/* Category trends */}
      <section className="space-y-3">
        <div>
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Category trends</p>
          <p className="text-xs text-[#6B6B66] mt-0.5">
            Rising categories get +15% demand boost in seasonal forecasts; declining get −15%.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-xl border border-[#E5E5E2] bg-[#F7F7F5] p-5 text-center">
            <p className="text-sm text-[#6B6B66]">No product categories found. Add a category to your products first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <CategoryTrendRow key={cat} category={cat} signals={signals} />
            ))}
          </div>
        )}
      </section>

      {/* Manual market notes */}
      <section className="space-y-3">
        <div>
          <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Market notes</p>
          <p className="text-xs text-[#6B6B66] mt-0.5">
            Record market events. Notes tagged <em>supplier_change</em> or <em>competitor_action</em> surface on relevant detail pages.
          </p>
        </div>
        <ManualNotesSection signals={signals} />
      </section>

    </div>
  );
}

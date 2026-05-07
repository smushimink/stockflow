"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUSES = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

interface FilterChipsProps {
  current: string;
  counts: Record<string, number>;
  total: number;
}

export function FilterChips({ current, counts, total }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map(({ key, label }) => {
        const isActive = current === key;
        const count = key === "all" ? total : (counts[key] ?? 0);
        const href = key === "all" ? "/purchases" : `/purchases?status=${key}`;

        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-500 px-3 py-1.5 rounded-full border transition-colors",
              isActive
                ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#C8C8C4] hover:text-[#1A1A17]"
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn("text-[10px] tabular-nums", isActive ? "text-white/70" : "text-[#6B6B66]")}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/insights/inventory", label: "Inventory" },
  { href: "/insights/sales", label: "Sales" },
  { href: "/insights/abc", label: "ABC-XYZ" },
  { href: "/insights/dead-stock", label: "Dead stock" },
  { href: "/insights/forecast", label: "Forecast" },
  { href: "/insights/cash", label: "Cash flow" },
  { href: "/insights/profitability", label: "Profitability" },
  { href: "/insights/seasonality", label: "Seasonality" },
  { href: "/insights/market", label: "Market" },
  { href: "/insights/break-even", label: "Break-even" },
  { href: "/insights/regression", label: "Regression" },
  { href: "/insights/bundles", label: "Bundles" },
];

export function InsightsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-0 border-b border-[#E5E5E2]">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-500 border-b-2 -mb-px transition-colors",
              active
                ? "border-[#1A1A17] text-[#1A1A17]"
                : "border-transparent text-[#6B6B66] hover:text-[#1A1A17]"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { SeverityGroup } from "@/components/today/severity-group";
import type { AlertWithProduct } from "@/lib/decisions/types";

const DEFAULT_LIMIT = 15;

interface TodayFeedProps {
  alerts: AlertWithProduct[];
  ruleConfigs: Record<string, Record<string, unknown>>;
}

export function TodayFeed({ alerts, ruleConfigs }: TodayFeedProps) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? alerts : alerts.slice(0, DEFAULT_LIMIT);
  const hidden = alerts.length - visible.length;

  const red = visible.filter((a) => a.severity === "red");
  const orange = visible.filter((a) => a.severity === "orange");
  const yellow = visible.filter((a) => a.severity === "yellow");

  return (
    <div className="space-y-6">
      <SeverityGroup title="Urgent" severity="red" alerts={red} ruleConfigs={ruleConfigs} />
      <SeverityGroup title="This week" severity="orange" alerts={orange} ruleConfigs={ruleConfigs} />
      <SeverityGroup title="Monitor" severity="yellow" alerts={yellow} ruleConfigs={ruleConfigs} />

      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-xs text-[#6B6B66] hover:text-[#1A1A17] py-2 border border-dashed border-[#E5E5E2] rounded-lg transition-colors"
        >
          View all ({hidden} more)
        </button>
      )}
    </div>
  );
}

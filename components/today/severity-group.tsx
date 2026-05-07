import { cn } from "@/lib/utils";
import { ActionCard } from "@/components/today/action-card";
import type { AlertWithProduct } from "@/lib/decisions/types";

interface SeverityGroupProps {
  title: string;
  severity: "red" | "orange" | "yellow" | "green";
  alerts: AlertWithProduct[];
  ruleConfigs: Record<string, Record<string, unknown>>;
}

const severityStyles = {
  red: { dot: "bg-[#C54632]", count: "text-[#C54632]" },
  orange: { dot: "bg-[#B47214]", count: "text-[#B47214]" },
  yellow: { dot: "bg-[#B47214] opacity-60", count: "text-[#B47214]" },
  green: { dot: "bg-[#4D7B3D]", count: "text-[#4D7B3D]" },
};

export function SeverityGroup({ title, severity, alerts, ruleConfigs }: SeverityGroupProps) {
  const styles = severityStyles[severity];

  if (!alerts.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />
        <h2 className="text-sm font-600 text-[#1A1A17]">{title}</h2>
        <span className={cn("text-xs font-600 tabular-nums", styles.count)}>
          {alerts.length}
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => (
          <ActionCard key={alert.id} alert={alert} ruleConfig={ruleConfigs[alert.rule_type] ?? {}} />
        ))}
      </div>
    </section>
  );
}

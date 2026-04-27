import { cn } from "@/lib/utils";
import { ActionCard } from "@/components/today/action-card";
import type { AlertWithProduct } from "@/lib/decisions/types";

interface SeverityGroupProps {
  title: string;
  severity: "red" | "orange" | "yellow" | "green";
  alerts: AlertWithProduct[];
  emptyMessage?: string;
}

const severityStyles = {
  red: { dot: "bg-[#C54632]", count: "text-[#C54632]" },
  orange: { dot: "bg-[#B47214]", count: "text-[#B47214]" },
  yellow: { dot: "bg-[#B47214] opacity-60", count: "text-[#B47214]" },
  green: { dot: "bg-[#4D7B3D]", count: "text-[#4D7B3D]" },
};

export function SeverityGroup({ title, severity, alerts, emptyMessage }: SeverityGroupProps) {
  const styles = severityStyles[severity];

  if (!alerts.length && !emptyMessage) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0", styles.dot)} />
        <h2 className="text-sm font-600 text-[#1A1A17]">{title}</h2>
        <span className={cn("text-xs font-600 tabular-nums", styles.count)}>
          {alerts.length}
        </span>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <ActionCard key={alert.id} alert={alert} />
          ))}
        </div>
      ) : (
        emptyMessage && (
          <div className="px-4 py-3 rounded-lg border border-[#E5E5E2] bg-white text-sm text-[#6B6B66]">
            {emptyMessage}
          </div>
        )
      )}
    </section>
  );
}

"use client";

import { cn } from "@/lib/utils";

type Integration = {
  id: string;
  name: string;
  category: string;
  comingSoon: boolean;
};

type ConnectedIntegration = {
  id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
};

export function ConnectedList({ connected }: { connected: ConnectedIntegration[] }) {
  if (connected.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-600 text-[#1A1A17]">Connected</h2>
      <div className="space-y-2">
        {connected.map((integration) => {
          const statusColor =
            integration.status === "active"
              ? "bg-[#4D7B3D]"
              : integration.status === "error"
              ? "bg-[#C54632]"
              : "bg-[#6B6B66]";
          const statusLabel =
            integration.status === "active"
              ? "Active"
              : integration.status === "error"
              ? "Error"
              : "Disconnected";

          return (
            <div
              key={integration.id}
              className="flex items-center gap-3 bg-white border border-[#E5E5E2] rounded-lg px-4 py-3"
            >
              <div className={cn("w-2 h-2 rounded-full shrink-0", statusColor)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-[#1A1A17] capitalize">{integration.provider}</p>
                <p className="text-xs text-[#6B6B66]">
                  {statusLabel}
                  {integration.last_sync_at && (
                    <> · Last synced {new Date(integration.last_sync_at).toLocaleDateString("en-AU")}</>
                  )}
                </p>
              </div>
              <button className="text-xs text-[#6B6B66] border border-[#E5E5E2] rounded px-2 py-1 hover:border-[#C8C8C4] bg-white transition-colors">
                Configure
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AvailableGrid({
  integrations,
  connectedIds,
}: {
  integrations: Integration[];
  connectedIds: string[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-600 text-[#1A1A17]">Available</h2>
      <div className="grid grid-cols-2 gap-2">
        {integrations.map((int) => {
          if (connectedIds.includes(int.id)) return null;

          return (
            <button
              key={int.id}
              disabled={int.comingSoon}
              className={cn(
                "flex items-center gap-3 bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 text-left transition-colors",
                int.comingSoon
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-[#C8C8C4] cursor-pointer"
              )}
              onClick={() => {
                if (!int.comingSoon) {
                  alert(`${int.name} integration coming soon!`);
                }
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-[#1A1A17]">{int.name}</p>
                <p className="text-xs text-[#6B6B66]">{int.category}</p>
              </div>
              {int.comingSoon && (
                <span className="text-[10px] text-[#6B6B66] border border-[#E5E5E2] rounded px-1.5 py-0.5 shrink-0">
                  Soon
                </span>
              )}
            </button>
          );
        })}
        <button className="flex items-center justify-center gap-2 border-2 border-dashed border-[#E5E5E2] rounded-lg px-4 py-3 text-xs text-[#6B6B66] hover:border-[#C8C8C4] transition-colors">
          + Request integration
        </button>
      </div>
    </section>
  );
}

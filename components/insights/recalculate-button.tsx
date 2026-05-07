"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RecalculateButtonProps {
  endpoint?: string;
  label?: string;
  successMessage?: string;
}

export function RecalculateButton({
  endpoint = "/api/insights/abc/recalculate",
  label = "Recalculate",
  successMessage,
}: RecalculateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function recalculate() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Recalculation failed");
        return;
      }
      toast.success(
        successMessage ??
          (data.classified != null
            ? `Updated — ${data.classified as number} products classified`
            : "Recalculation complete")
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={recalculate}
      disabled={loading}
      className={cn(
        "flex items-center gap-1.5 text-xs font-500 px-3 py-1.5 rounded-lg border border-[#E5E5E2] bg-white hover:border-[#C8C8C4] hover:text-[#1A1A17] transition-colors",
        loading ? "text-[#C8C8C4] cursor-not-allowed" : "text-[#6B6B66]"
      )}
    >
      <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
      {loading ? "Recalculating…" : label}
    </button>
  );
}

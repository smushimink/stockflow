"use client";

import { useState } from "react";

type PlanKey = "starter" | "pro" | "business";

interface Props {
  planKey: PlanKey;
  highlight: boolean;
}

export function PricingCta({ planKey, highlight }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });

      if (res.status === 401) {
        window.location.href = `/signup?plan=${planKey}`;
        return;
      }

      const data = await res.json();

      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-60"
        style={
          highlight
            ? { background: "#1A1A17", color: "white" }
            : { background: "#F0F0EE", color: "#1A1A17" }
        }
        onMouseEnter={(e) => {
          if (highlight) e.currentTarget.style.background = "#2D2D29";
          else e.currentTarget.style.background = "#E5E5E2";
        }}
        onMouseLeave={(e) => {
          if (highlight) e.currentTarget.style.background = "#1A1A17";
          else e.currentTarget.style.background = "#F0F0EE";
        }}
      >
        {loading ? "Loading…" : "Start for $1"}
      </button>
      {error && <p className="text-xs text-center text-[#C54632]">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface OrgBilling {
  plan: string;
  subscription_status: string;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:     { label: "Active",     color: "#3E7A2E" },
  trialing:   { label: "Trialing",   color: "#B47214" },
  past_due:   { label: "Past due",   color: "#C54632" },
  cancelled:  { label: "Cancelled",  color: "#9B9B96" },
  incomplete: { label: "Incomplete", color: "#9B9B96" },
  free:       { label: "Free plan",  color: "#9B9B96" },
};

const PLAN_LABELS: Record<string, string> = {
  free:     "Free",
  starter:  "Starter — $99/mo",
  pro:      "Pro — $249/mo",
  business: "Business — $599/mo",
};

export default function BillingSettingsPage() {
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get org membership
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) { setLoading(false); return; }

      const { data: org } = await supabase
        .from("organizations")
        .select("plan, subscription_status, stripe_subscription_id, subscription_current_period_end")
        .eq("id", membership.organization_id)
        .single();

      setBilling(org ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (!res.ok) {
      setError("Couldn't open billing portal. Please try again.");
      setPortalLoading(false);
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="h-6 w-32 bg-[#E5E5E2] rounded animate-pulse mb-4" />
        <div className="h-40 bg-[#E5E5E2] rounded-xl animate-pulse" />
      </div>
    );
  }

  const isSubscribed =
    billing?.subscription_status === "active" ||
    billing?.subscription_status === "trialing";

  const statusInfo = STATUS_LABEL[billing?.subscription_status ?? "free"];
  const periodEnd = billing?.subscription_current_period_end
    ? new Date(billing.subscription_current_period_end).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A17]">Billing</h1>
        <p className="mt-1 text-sm text-[#6B6B66]">
          Manage your plan and payment method.
        </p>
      </div>

      <div className="rounded-xl border border-[#E5E5E2] bg-white divide-y divide-[#F0F0EE]">
        {/* Current plan */}
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6B6B66] mb-0.5">Current plan</p>
            <p className="text-sm font-medium text-[#1A1A17]">
              {PLAN_LABELS[billing?.plan ?? "free"]}
            </p>
          </div>
          {statusInfo && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: statusInfo.color + "18",
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          )}
        </div>

        {/* Next billing */}
        {periodEnd && (
          <div className="p-5">
            <p className="text-xs text-[#6B6B66] mb-0.5">Next billing date</p>
            <p className="text-sm font-medium text-[#1A1A17]">{periodEnd}</p>
          </div>
        )}

        {/* Actions */}
        <div className="p-5">
          {isSubscribed ? (
            <div className="space-y-3">
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E5E5E2] text-[#1A1A17] hover:bg-[#F7F7F5] transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage billing"}
              </button>
              {error && <p className="text-xs text-[#C54632]">{error}</p>}
              <p className="text-xs text-[#9B9B96]">
                Update payment method, download invoices, or cancel — all from Stripe&apos;s
                secure billing portal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#6B6B66]">
                You&apos;re on the free plan. Upgrade to unlock all decision rules.
              </p>
              <Link
                href="/pricing"
                className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-[#1A1A17] text-white hover:bg-[#2D2D29] transition-colors"
              >
                View plans — start for $1
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

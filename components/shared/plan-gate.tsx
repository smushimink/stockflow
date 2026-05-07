"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { PlanId } from "@/lib/plans";
import { PLAN_LIMITS, UPGRADE_URL } from "@/lib/plans";

interface PlanGateBannerProps {
  currentPlan: PlanId;
  requiredPlan: PlanId;
  featureName: string;
  className?: string;
}

export function PlanGateBanner({ currentPlan, requiredPlan, featureName, className = "" }: PlanGateBannerProps) {
  const required = PLAN_LIMITS[requiredPlan];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border border-[#E5E5E2] bg-[#FAFAF8] ${className}`}>
      <div className="w-7 h-7 rounded-full bg-[#F0F0EE] flex items-center justify-center shrink-0 mt-0.5">
        <Lock size={13} className="text-[#6B6B66]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-500 text-[#1A1A17]">{featureName} — {required.label} plan</p>
        <p className="text-xs text-[#6B6B66] mt-0.5">
          You&apos;re on the {PLAN_LIMITS[currentPlan].label} plan. Upgrade to {required.label} to unlock this feature.
        </p>
      </div>
      <Link
        href={UPGRADE_URL}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-500 text-white bg-[#1A1A17] hover:bg-[#2D2D29] transition-colors"
      >
        Upgrade
      </Link>
    </div>
  );
}

interface PlanLockBadgeProps {
  requiredPlan: PlanId;
}

export function PlanLockBadge({ requiredPlan }: PlanLockBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-600 uppercase tracking-wide bg-[#F0F0EE] text-[#6B6B66]">
      <Lock size={9} />
      {PLAN_LIMITS[requiredPlan].label}
    </span>
  );
}

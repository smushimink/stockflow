"use client";

import { cn } from "@/lib/utils";
import type { AlertWithProduct } from "@/lib/decisions/types";
import type { ReasoningSegment, TrailSegmentType } from "@/lib/decisions/reasoning";

// Visual config per segment type
const SEGMENT_CONFIG: Record<
  TrailSegmentType,
  { label: string; border: string; tag: string }
> = {
  data:      { label: "DATA",    border: "border-[#1A6B9A]", tag: "bg-[#EBF4FA] text-[#1A6B9A]" },
  rule:      { label: "RULE",    border: "border-[#9B9B96]", tag: "bg-[#F7F7F5] text-[#6B6B66]" },
  calc:      { label: "CALC",    border: "border-[#7C6FAD]", tag: "bg-[#F3F1F9] text-[#5B4F8E]" },
  context:   { label: "CONTEXT", border: "border-[#B47214]", tag: "bg-[#FDF8EE] text-[#B47214]" },
  signal:    { label: "SIGNAL",  border: "border-[#2D7D6B]", tag: "bg-[#EBF5F2] text-[#2D7D6B]" },
  historical:{ label: "HISTORY", border: "border-[#4D7B3D]", tag: "bg-[#F2F8F0] text-[#4D7B3D]" },
  stat:      { label: "STATS",   border: "border-[#5B3FA8]", tag: "bg-[#F0ECFA] text-[#5B3FA8]" },
  verdict:   { label: "TRIGGER", border: "border-[#C54632]", tag: "bg-[#FDF2F0] text-[#C54632]" },
};

interface ReasoningTrailProps {
  alert: AlertWithProduct;
}

export function ReasoningTrail({ alert }: ReasoningTrailProps) {
  const trail = alert.metadata?.reasoning_trail as ReasoningSegment[] | undefined;

  // Fall back to plain text when no structured trail exists
  if (!trail?.length) {
    if (!alert.reasoning) return null;
    return (
      <div className="bg-white/60 rounded-md px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66] mb-1.5">Why</p>
        <p className="text-xs text-[#1A1A17] leading-relaxed">{alert.reasoning}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/60 rounded-md px-3 py-2.5 space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-600 text-[#6B6B66]">Decision trail</p>
      <div className="space-y-1.5">
        {trail.map((seg, i) => {
          const cfg = SEGMENT_CONFIG[seg.type] ?? SEGMENT_CONFIG.data;
          return (
            <div key={i} className={cn("flex gap-2.5 pl-2.5 border-l-2", cfg.border)}>
              <span
                className={cn(
                  "shrink-0 text-[9px] font-700 px-1.5 py-0.5 rounded uppercase tracking-wider self-start mt-px",
                  cfg.tag
                )}
              >
                {cfg.label}
              </span>
              <p className="text-xs text-[#1A1A17] leading-relaxed">{seg.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

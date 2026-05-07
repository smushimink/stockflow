// Structured reasoning trail for decision alerts.
// Each segment captures one step of the justification chain.
// Rules store segments in metadata.reasoning_trail; the UI renders them visually.

export type TrailSegmentType =
  | "data"       // Observed metric (sales, stock, days)
  | "rule"       // Rule config / threshold applied
  | "calc"       // Mathematical derivation
  | "context"    // Business context influence (perishable, industry, payment terms)
  | "signal"     // Market signal applied (FX, category trend)
  | "historical" // Historical pattern reference
  | "stat"       // Statistical model output (R², p-value, confidence interval)
  | "verdict";   // The final trigger reason

export interface ReasoningSegment {
  type: TrailSegmentType;
  label: string;
  text: string;
}

/** Concatenate segments into a single rich reasoning paragraph for the DB field. */
export function segmentsToText(segments: ReasoningSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}

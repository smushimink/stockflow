import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { HeatmapRow, InsufficientDataState } from "@/components/insights/seasonality-heatmap";
import { SeasonalityHeatmap } from "@/components/insights/seasonality-heatmap";
import type { MonthIndex } from "@/lib/analytics/seasonality";

export const dynamic = "force-dynamic";

export default async function SeasonalityPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id as string;

  // ── Load detected patterns ────────────────────────────────────────────────

  const { data: patterns } = await supabase
    .from("seasonality_patterns")
    .select(`
      id, product_id, peak_periods, confidence, manually_confirmed, detected_at,
      products ( id, sku, name )
    `)
    .eq("organization_id", orgId)
    .eq("pattern_type", "annual")
    .order("confidence", { ascending: false });

  // ── Build heatmap rows ────────────────────────────────────────────────────

  const rows: HeatmapRow[] = [];

  for (const pattern of patterns ?? []) {
    if (!pattern.product_id) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productRaw = pattern.products as any;
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
    if (!product) continue;

    const peakPeriods = (pattern.peak_periods as MonthIndex[]) ?? [];

    // Build a 12-element array (index 0 = Jan) from the stored monthly shape
    const monthlyIndices = new Array(12).fill(0);
    for (const entry of peakPeriods) {
      if (entry.month >= 1 && entry.month <= 12) {
        monthlyIndices[entry.month - 1] = entry.multiplier;
      }
    }

    rows.push({
      patternId: pattern.id as string,
      productId: pattern.product_id as string,
      productName: (product.name as string) ?? "Unknown",
      sku: (product.sku as string) ?? "—",
      monthlyIndices,
      confidence: pattern.confidence as number,
      manuallyConfirmed: pattern.manually_confirmed as boolean,
    });
  }

  // Cap at top 20 by confidence
  const displayRows = rows.slice(0, 20);

  // ── Determine whether detection has been attempted ────────────────────────

  const lastDetectedAt =
    patterns && patterns.length > 0
      ? (patterns[0].detected_at as string)
      : null;

  // If no patterns exist, check whether we have enough data to show the
  // insufficient-data state. Sample the sales history span.
  let insufficientData: InsufficientDataState | null = null;

  if (rows.length === 0) {
    const { data: firstSale } = await supabase
      .from("sales_orders")
      .select("ordered_at")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .order("ordered_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: lastSale } = await supabase
      .from("sales_orders")
      .select("ordered_at")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .order("ordered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (firstSale && lastSale) {
      const t0 = new Date(firstSale.ordered_at as string);
      const t1 = new Date(lastSale.ordered_at as string);
      const dataMonths =
        (t1.getFullYear() - t0.getFullYear()) * 12 +
        (t1.getMonth() - t0.getMonth()) +
        1;

      if (dataMonths < 12) {
        insufficientData = {
          dataMonths,
          minRequired: 12,
          message: `Seasonality detection requires at least 12 months. Currently you have ${dataMonths} month${dataMonths !== 1 ? "s" : ""}. Patterns will improve over time.`,
        };
      }
    } else {
      insufficientData = {
        dataMonths: 0,
        minRequired: 12,
        message:
          "No sales data found. Add sales history or import data to enable seasonality detection.",
      };
    }
  }

  return (
    <SeasonalityHeatmap
      rows={displayRows}
      insufficientData={insufficientData}
      lastDetectedAt={lastDetectedAt}
    />
  );
}

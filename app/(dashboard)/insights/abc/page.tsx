import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { RecalculateButton } from "@/components/insights/recalculate-button";
import { classifyAbcXyz, buildAbcXyzMatrix, ABC_XYZ_STRATEGIES } from "@/lib/analytics/abc-xyz";
import type { AbcXyzClass, AbcXyzResult } from "@/lib/analytics/abc-xyz";

export const dynamic = "force-dynamic";

// ── Visual config for the 9 cells ─────────────────────────────────────────────

type CellConfig = { bg: string; border: string; label: string; labelColor: string; priority: "high" | "medium" | "low" | "watch" };

const CELL_CONFIG: Record<AbcXyzClass, CellConfig> = {
  AX: { bg: "bg-[#F2F8F0]",  border: "border-[#4D7B3D]/30",  label: "Automate", labelColor: "text-[#4D7B3D]",  priority: "high" },
  AY: { bg: "bg-[#F5FAF3]",  border: "border-[#4D7B3D]/20",  label: "Buffer",   labelColor: "text-[#4D7B3D]",  priority: "high" },
  AZ: { bg: "bg-[#FDF8EE]",  border: "border-[#B47214]/30",  label: "Forecast", labelColor: "text-[#B47214]",  priority: "watch" },
  BX: { bg: "bg-[#F7F7F5]",  border: "border-[#9B9B96]/20",  label: "Standard", labelColor: "text-[#6B6B66]",  priority: "medium" },
  BY: { bg: "bg-[#F7F7F5]",  border: "border-[#9B9B96]/20",  label: "Seasonal", labelColor: "text-[#6B6B66]",  priority: "medium" },
  BZ: { bg: "bg-[#FDF8EE]",  border: "border-[#B47214]/20",  label: "Reduce",   labelColor: "text-[#B47214]",  priority: "watch" },
  CX: { bg: "bg-white",      border: "border-[#E5E5E2]",     label: "Lean",     labelColor: "text-[#9B9B96]",  priority: "low" },
  CY: { bg: "bg-[#FDF8EE]",  border: "border-[#B47214]/10",  label: "Candidate",labelColor: "text-[#B47214]",  priority: "watch" },
  CZ: { bg: "bg-[#FDF2F0]",  border: "border-[#C54632]/20",  label: "Liquidate",labelColor: "text-[#C54632]",  priority: "low" },
};

const CLASSES: AbcXyzClass[] = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];
const ABC_ROWS: Array<"A" | "B" | "C"> = ["A", "B", "C"];
const XYZ_COLS: Array<"X" | "Y" | "Z"> = ["X", "Y", "Z"];

export default async function AbcXyzPage() {
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

  const orgId = membership.organization_id;

  // Check if we have any xyz_class data already stored
  const admin = createAdminClient();
  const { data: existingXyz } = await admin
    .from("products")
    .select("id, abc_class, xyz_class, abc_xyz_class, sku, name, category, unit_cost, selling_price")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .not("abc_xyz_class", "is", null);

  // Also load product metrics for GP data
  const { data: metricsRaw } = await admin
    .from("product_metrics")
    .select("product_id, revenue_90d, real_margin_pct, calculated_at")
    .eq("organization_id", orgId);

  const metricsMap = new Map((metricsRaw ?? []).map((m) => [m.product_id as string, m]));

  const lastCalcAt = (metricsRaw ?? [])
    .map((m) => m.calculated_at as string)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  // Build results from stored data if available, else run classifier live for fresh data
  let results: AbcXyzResult[];
  let isLive = false;

  if (existingXyz && existingXyz.length > 0) {
    // Reconstruct from stored data
    results = existingXyz.map((p) => {
      const m = metricsMap.get(p.id as string);
      const rev = (m?.revenue_90d as number) ?? 0;
      const margin = (m?.real_margin_pct as number) ?? 0;
      const gp = rev * margin;
      return {
        product_id: p.id as string,
        sku: p.sku as string,
        name: p.name as string,
        category: p.category as string | null,
        abc_class: (p.abc_class ?? "C") as "A" | "B" | "C",
        xyz_class: (p.xyz_class ?? "Z") as "X" | "Y" | "Z",
        combined_class: (p.abc_xyz_class ?? "CZ") as AbcXyzClass,
        gross_profit_90d: Math.round(gp * 100) / 100,
        weekly_avg_units: 0,
        cv: 0,
        recommended_strategy: ABC_XYZ_STRATEGIES[(p.abc_xyz_class ?? "CZ") as AbcXyzClass],
        weeks_with_data: 0,
      };
    });
  } else {
    // No stored classification — run live (only if metrics exist)
    if (metricsRaw && metricsRaw.length > 0) {
      results = await classifyAbcXyz(orgId);
      isLive = true;
    } else {
      results = [];
    }
  }

  const matrix = buildAbcXyzMatrix(results);

  // Group results by class for the detail table
  const byClass = CLASSES.reduce<Record<AbcXyzClass, AbcXyzResult[]>>(
    (acc, cls) => { acc[cls] = []; return acc; },
    {} as Record<AbcXyzClass, AbcXyzResult[]>
  );
  for (const r of results) byClass[r.combined_class].push(r);

  const totalProducts = results.length;
  const totalGp90d = results.reduce((s, r) => s + r.gross_profit_90d, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6B6B66]">
            {results.length > 0
              ? isLive
                ? `Live classification — ${totalProducts} products. Click Recalculate to save.`
                : lastCalcAt
                ? `Last calculated: ${new Date(lastCalcAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                : `${totalProducts} products classified`
              : "No data yet — click Recalculate to classify your products"}
          </p>
        </div>
        <RecalculateButton endpoint="/api/insights/abc/recalculate" label="Recalculate ABC-XYZ" />
      </div>

      {results.length === 0 ? (
        <div className="py-16 text-center text-sm text-[#6B6B66]">
          Run recalculation to classify products. Requires at least 30 days of sales data.
        </div>
      ) : (
        <>
          {/* ── 9-Cell Matrix ──────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center gap-4">
              <h2 className="text-sm font-600 text-[#1A1A17]">ABC-XYZ Matrix</h2>
              <div className="flex items-center gap-3 text-xs text-[#6B6B66]">
                <span><span className="font-600 text-[#1A1A17]">ABC</span> = gross profit share (90d)</span>
                <span className="text-[#C8C8C4]">·</span>
                <span><span className="font-600 text-[#1A1A17]">XYZ</span> = demand variability (26w)</span>
              </div>
            </div>

            <div className="grid grid-cols-[64px_1fr_1fr_1fr] gap-1.5">
              {/* Column headers */}
              <div />
              {XYZ_COLS.map((x) => (
                <div key={x} className="text-center pb-1">
                  <span className="text-[11px] font-600 text-[#6B6B66] uppercase tracking-wider">
                    {x === "X" ? "X — Stable" : x === "Y" ? "Y — Variable" : "Z — Erratic"}
                  </span>
                </div>
              ))}

              {/* Rows */}
              {ABC_ROWS.map((abc) => (
                <>
                  <div key={`label-${abc}`} className="flex items-center justify-center">
                    <span className="text-[11px] font-600 text-[#6B6B66] uppercase tracking-wider writing-vertical">
                      {abc === "A" ? "A · High profit" : abc === "B" ? "B · Mid" : "C · Low profit"}
                    </span>
                  </div>
                  {XYZ_COLS.map((xyz) => {
                    const cls = `${abc}${xyz}` as AbcXyzClass;
                    const cfg = CELL_CONFIG[cls];
                    const count = matrix[cls];
                    const cellProds = byClass[cls];
                    const cellGp = cellProds.reduce((s, r) => s + r.gross_profit_90d, 0);
                    const gpShare = totalGp90d > 0 ? (cellGp / totalGp90d) * 100 : 0;

                    return (
                      <div
                        key={cls}
                        className={cn(
                          "rounded-lg border p-3 space-y-1.5 transition-colors",
                          cfg.bg, cfg.border,
                          count === 0 && "opacity-40"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-base font-700 text-[#1A1A17]">{cls}</span>
                          <span className={cn("text-[10px] font-600 uppercase tracking-wider", cfg.labelColor)}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-lg font-600 text-[#1A1A17] tabular-nums">{count}</p>
                        <p className="text-[10px] text-[#6B6B66]">
                          {gpShare > 0 ? `${gpShare.toFixed(0)}% of GP` : "no GP data"}
                        </p>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          {/* ── Distribution summary ────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {(["AX", "AZ", "CZ"] as AbcXyzClass[]).map((cls) => {
              const cfg = CELL_CONFIG[cls];
              const count = matrix[cls];
              const strategy = ABC_XYZ_STRATEGIES[cls];
              return (
                <div key={cls} className={cn("rounded-lg border p-3", cfg.bg, cfg.border)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-700 text-[#1A1A17]">{cls}</span>
                    <span className="text-lg font-600 text-[#1A1A17] tabular-nums">{count}</span>
                  </div>
                  <p className="text-[11px] text-[#6B6B66] leading-relaxed">{strategy}</p>
                </div>
              );
            })}
          </div>

          {/* ── Product detail table ─────────────────────────────────────────── */}
          <div className="space-y-3">
            {CLASSES.filter((cls) => byClass[cls].length > 0).map((cls) => {
              const cfg = CELL_CONFIG[cls];
              const prods = byClass[cls];
              const gpTotal = prods.reduce((s, r) => s + r.gross_profit_90d, 0);

              return (
                <div key={cls} className={cn("rounded-lg border overflow-hidden", cfg.border)}>
                  <div className={cn("px-4 py-2.5 flex items-center justify-between", cfg.bg)}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-700 text-[#1A1A17]">{cls}</span>
                      <span className="text-xs text-[#6B6B66]">{prods.length} products</span>
                      <span className={cn("text-[10px] font-600 uppercase tracking-wider", cfg.labelColor)}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-xs font-500 text-[#6B6B66] tabular-nums">
                      {formatCurrency(gpTotal)} GP (90d)
                    </span>
                  </div>
                  <div className="divide-y divide-black/5 max-h-48 overflow-y-auto bg-white">
                    {prods
                      .sort((a, b) => b.gross_profit_90d - a.gross_profit_90d)
                      .map((p) => (
                        <div key={p.product_id} className="px-4 py-2 hover:bg-[#F7F7F5] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-500 text-[#1A1A17] truncate">{p.sku}</p>
                            <p className="text-[11px] text-[#6B6B66] truncate">{p.name}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            {p.gross_profit_90d > 0 && (
                              <p className="text-xs tabular-nums font-500 text-[#1A1A17]">
                                {formatCurrency(p.gross_profit_90d)} GP
                              </p>
                            )}
                            {p.cv > 0 && (
                              <p className="text-[10px] tabular-nums text-[#6B6B66]">CV {p.cv.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className={cn("px-4 py-2 border-t border-black/5 text-[10px] text-[#6B6B66]", cfg.bg)}>
                    {ABC_XYZ_STRATEGIES[cls]}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

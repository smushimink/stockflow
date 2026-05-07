import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TodayFeed } from "@/components/today/today-feed";
import { firstOf, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import type { AlertWithProduct } from "@/lib/decisions/types";

export const dynamic = "force-dynamic";

function greeting(email: string | undefined): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  if (!email) return part;
  const name = email.split("@")[0].split(/[._-]/)[0];
  return `${part}, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
}

export default async function TodayPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgName = firstOf<{ name: string }>((membership as any).organizations)?.name ?? "Your workspace";

  const [
    { data: alertsRaw },
    { data: metricsAgg },
    { data: topCustomer },
    { data: topSupplier },
    { data: dbRules },
  ] = await Promise.all([
    supabase
      .from("decision_alerts")
      .select(`
        id, rule_type, severity, status, title, summary, reasoning,
        suggested_action, suggested_value, suggested_qty, metadata,
        created_at, related_product_id, related_customer_id, related_supplier_id,
        products (
          id, sku, name, selling_price, unit_cost, stock_on_hand, category,
          suppliers (name)
        )
      `)
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
    // Inventory cash + dead stock aggregates
    supabase
      .from("product_metrics")
      .select("cash_tied_up, days_since_last_sale, days_of_cover")
      .eq("organization_id", orgId),
    // Top customer by gross_profit_90d
    supabase
      .from("customers")
      .select("id, name, gross_profit_90d")
      .eq("organization_id", orgId)
      .gt("gross_profit_90d", 0)
      .order("gross_profit_90d", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Top supplier by avg_margin_on_supplied
    supabase
      .from("suppliers")
      .select("id, name, avg_margin_on_supplied")
      .eq("organization_id", orgId)
      .not("avg_margin_on_supplied", "is", null)
      .order("avg_margin_on_supplied", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Rule configs for inline threshold editing on action cards
    supabase
      .from("decision_rules")
      .select("rule_type, config")
      .eq("organization_id", orgId),
  ]);

  // Build rule config map for inline threshold editing on action cards
  const ruleConfigs: Record<string, Record<string, unknown>> = {};
  for (const row of dbRules ?? []) {
    ruleConfigs[row.rule_type as string] = row.config as Record<string, unknown>;
  }

  // Supabase returns alerts sorted by created_at DESC; severity priority sort client-side
  const allAlerts = (alertsRaw ?? []) as unknown as AlertWithProduct[];
  const alerts = [...allAlerts].sort((a, b) => {
    const rank = { red: 0, orange: 1, yellow: 2, green: 3 } as Record<string, number>;
    const diff = (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Hero stats
  const redAlerts = alerts.filter((a) => a.severity === "red");
  const urgentCount = redAlerts.length;

  const cashToFree = alerts
    .filter((a) => (a.rule_type === "dead_stock" || a.rule_type === "reorder") && a.severity === "red")
    .reduce((sum, a) => sum + (a.suggested_value ?? 0), 0);

  const stockoutRisks = alerts.filter(
    (a) => a.rule_type === "reorder" && a.severity === "red"
  ).length;

  // Money lens stats
  const reorderCount = alerts.filter((a) => a.rule_type === "reorder").length;
  const metrics = metricsAgg ?? [];
  const totalInventoryCash = metrics.reduce((s, m) => s + (m.cash_tied_up as number), 0);
  const slowCash = metrics
    .filter((m) => {
      const cover = m.days_of_cover as number;
      return cover >= 90 && cover < 9999;
    })
    .reduce((s, m) => s + (m.cash_tied_up as number), 0);
  const deadCash = metrics
    .filter((m) => {
      const idle = m.days_since_last_sale as number | null;
      return idle !== null && idle >= 180;
    })
    .reduce((s, m) => s + (m.cash_tied_up as number), 0);
  const slowPct = totalInventoryCash > 0
    ? Math.round((slowCash / totalInventoryCash) * 100)
    : 0;

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      {/* Hero header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[#6B6B66] uppercase tracking-wider font-600">{today}</p>
          <h1 className="text-2xl font-600 text-[#1A1A17] mt-0.5">{greeting(user.email)}.</h1>
          {alerts.length > 0 ? (
            <p className="text-sm text-[#6B6B66] mt-1">
              {alerts.length} action{alerts.length !== 1 ? "s" : ""} today
              {urgentCount > 0 && (
                <span className="text-[#C54632] font-600">
                  {" "}· {urgentCount} urgent
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-[#6B6B66] mt-1">Everything looks good for {orgName}.</p>
          )}
        </div>

        {/* Right-aligned stats */}
        {(cashToFree > 0 || stockoutRisks > 0) && (
          <div className="text-right shrink-0 space-y-1">
            {cashToFree > 0 && (
              <div>
                <p className="text-xs text-[#6B6B66]">Cash to free</p>
                <p className="text-sm font-600 text-[#C54632]">{formatCurrency(cashToFree)}</p>
              </div>
            )}
            {stockoutRisks > 0 && (
              <div>
                <p className="text-xs text-[#6B6B66]">Stockout risks</p>
                <p className="text-sm font-600 text-[#C54632]">{stockoutRisks}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Money lens strip ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <MoneyLensCard
          question="What to stock?"
          answer={
            reorderCount > 0
              ? `${reorderCount} SKU${reorderCount !== 1 ? "s" : ""} need reorder`
              : "All stocked up"
          }
          href="/insights/inventory"
          color={reorderCount > 0 ? "#C54632" : "#4D7B3D"}
        />
        <MoneyLensCard
          question="Best suppliers?"
          answer={
            topSupplier
              ? `${topSupplier.name as string} · ${((topSupplier.avg_margin_on_supplied as number) * 100).toFixed(0)}% margin`
              : "Run recalculate"
          }
          href="/insights/profitability"
          color="#1A1A17"
        />
        <MoneyLensCard
          question="Best customers?"
          answer={
            topCustomer
              ? `${topCustomer.name as string} · ${formatCurrency(topCustomer.gross_profit_90d as number)} profit`
              : "Run recalculate"
          }
          href="/customers"
          color="#1A1A17"
        />
        <MoneyLensCard
          question="How much stock?"
          answer={
            totalInventoryCash > 0
              ? `${formatCurrency(totalInventoryCash)} · ${slowPct}% slow`
              : "No inventory data"
          }
          href="/insights/cash"
          color={slowPct > 30 ? "#B47214" : "#1A1A17"}
        />
        <MoneyLensCard
          question="Cash stuck?"
          answer={
            deadCash > 0
              ? `${formatCurrency(deadCash)} dead · ${formatCurrency(slowCash)} slow`
              : slowCash > 0
              ? `${formatCurrency(slowCash)} in slow movers`
              : "No dead stock"
          }
          href="/insights/dead-stock"
          color={deadCash > 0 ? "#C54632" : deadCash === 0 && slowCash === 0 ? "#4D7B3D" : "#B47214"}
        />
      </div>

      {/* Alert feed */}
      {alerts.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[#F2F8F0] border border-[#4D7B3D]/20 flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9l4 4 8-8" stroke="#4D7B3D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-500 text-[#1A1A17]">No pending actions</p>
          <p className="text-xs text-[#6B6B66] mt-1">
            Alerts are generated nightly. Run the engine manually from the Rules page.
          </p>
        </div>
      ) : (
        <TodayFeed alerts={alerts} ruleConfigs={ruleConfigs} />
      )}
    </div>
  );
}

function MoneyLensCard({
  question,
  answer,
  href,
  color,
}: {
  question: string;
  answer: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-[#E5E5E2] rounded-lg px-3 py-2.5 hover:border-[#C8C8C4] hover:shadow-sm transition-all group"
    >
      <p className="text-[10px] text-[#6B6B66] leading-tight mb-1">{question}</p>
      <p className="text-xs font-500 leading-tight" style={{ color }}>
        {answer}
      </p>
    </Link>
  );
}

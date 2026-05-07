import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { MarketClient } from "@/components/insights/market-client";
import type { MarketSignal } from "@/lib/decisions/types";
import { DEFAULT_BUSINESS_CONTEXT } from "@/lib/decisions/types";
import type { BusinessContext } from "@/lib/decisions/types";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id as string;

  // Load business context (for primary currency)
  const { data: org } = await admin
    .from("organizations")
    .select("business_context")
    .eq("id", orgId)
    .single();

  const businessContext: BusinessContext = {
    ...DEFAULT_BUSINESS_CONTEXT,
    ...((org?.business_context as Partial<BusinessContext>) ?? {}),
  };

  const primaryCurrency = businessContext.primary_currency;

  // Foreign-currency suppliers
  const { data: suppliersRaw } = await admin
    .from("suppliers")
    .select("id, name, currency")
    .eq("organization_id", orgId)
    .eq("active", true)
    .neq("currency", primaryCurrency);

  // Build unique foreign-currency list with representative supplier names
  const currencyMap = new Map<string, string[]>();
  for (const s of suppliersRaw ?? []) {
    const c = s.currency as string;
    if (!currencyMap.has(c)) currencyMap.set(c, []);
    currencyMap.get(c)!.push(s.name as string);
  }
  const foreignCurrencies = Array.from(currencyMap.entries()).map(
    ([currency, supplierNames]) => ({ currency, supplierNames })
  );

  // Distinct active product categories
  const { data: productsRaw } = await admin
    .from("products")
    .select("category")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .not("category", "is", null);

  const categories = [
    ...new Set((productsRaw ?? []).map((p) => p.category as string)),
  ].filter(Boolean).sort();

  // All active market signals
  const today = new Date().toISOString().split("T")[0];
  const { data: signalsRaw } = await admin
    .from("market_signals")
    .select("id, signal_type, source, value, effective_from, effective_until, notes, created_at")
    .eq("organization_id", orgId)
    .or(`effective_until.is.null,effective_until.gte.${today}`)
    .order("created_at", { ascending: false });

  const signals = (signalsRaw ?? []) as MarketSignal[];

  return (
    <MarketClient
      primaryCurrency={primaryCurrency}
      foreignCurrencies={foreignCurrencies}
      categories={categories}
      signals={signals}
    />
  );
}

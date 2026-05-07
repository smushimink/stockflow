export type Severity = "red" | "orange" | "yellow" | "green";

export type AlertStatus = "pending" | "completed" | "snoozed" | "dismissed";

export interface Alert {
  organization_id: string;
  rule_type: string;
  related_product_id?: string;
  related_customer_id?: string;
  related_supplier_id?: string;
  severity: Severity;
  title: string;
  summary: string;
  reasoning: string;
  suggested_action?: string;
  suggested_value?: number;
  suggested_qty?: number;
  metadata: Record<string, unknown>;
}

export interface BusinessContext {
  business_type: "wholesale" | "retail" | "d2c" | "mixed";
  industry: "food_grocery" | "beauty" | "homeware" | "apparel" | "electronics" | "industrial" | "other";
  products_perishable: boolean;
  avg_shelf_life_days: number | null;
  warehouse_size_sqm: number | null;
  warehouse_cost_monthly: number | null;
  payment_terms_default_days: number;
  primary_currency: string;
  primary_country: string;
  active_seasons: string[];
  business_age_months: number;
  primary_sales_channels: string[];
  customer_concentration_risk_threshold: number;
  notes: string;
}

export const DEFAULT_BUSINESS_CONTEXT: BusinessContext = {
  business_type: "wholesale",
  industry: "other",
  products_perishable: false,
  avg_shelf_life_days: null,
  warehouse_size_sqm: null,
  warehouse_cost_monthly: null,
  payment_terms_default_days: 30,
  primary_currency: "AUD",
  primary_country: "AU",
  active_seasons: [],
  business_age_months: 12,
  primary_sales_channels: ["b2b_direct"],
  customer_concentration_risk_threshold: 30,
  notes: "",
};

// ── Market signals ────────────────────────────────────────────────────────────

export interface MarketSignal {
  id: string;
  signal_type: "fx_rate" | "commodity_price" | "inflation" | "category_trend" | "competitor_price" | "manual_note";
  source: string;
  value: Record<string, unknown>;
  effective_from: string;
  effective_until: string | null;
  notes: string | null;
  created_at: string;
}

// value shapes (for type narrowing in rules):
//   fx_rate:        { from_currency: string; to_currency: string; rate: number; prior_rate: number }
//   category_trend: { category: string; trend: "rising" | "stable" | "declining" }
//   manual_note:    { tags: string[]; text: string }

export interface RuleContext {
  orgId: string;
  config: Record<string, unknown>;
  businessContext: BusinessContext;
  marketSignals: MarketSignal[];
}

export interface DecisionRule {
  rule_type: string;
  defaultConfig: Record<string, unknown>;
  evaluate(ctx: RuleContext): Promise<Alert[]>;
}

export interface AlertWithProduct {
  id: string;
  rule_type: string;
  severity: Severity;
  status: AlertStatus;
  title: string;
  summary: string;
  reasoning: string | null;
  suggested_action: string | null;
  suggested_value: number | null;
  suggested_qty: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  related_product_id: string | null;
  related_customer_id: string | null;
  related_supplier_id: string | null;
  // Supabase returns joins as arrays; normalize with firstOf() before rendering
  products?: {
    id: string;
    sku: string;
    name: string;
    selling_price: number;
    unit_cost: number;
    stock_on_hand: number;
    category: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suppliers?: { name: string } | { name: string }[] | null | any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } | { id: string; sku: string; name: string; selling_price: number; unit_cost: number; stock_on_hand: number; category: string | null; suppliers?: any }[] | null;
}

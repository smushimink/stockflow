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

export interface DecisionRule {
  rule_type: string;
  defaultConfig: Record<string, unknown>;
  evaluate(orgId: string, config: Record<string, unknown>): Promise<Alert[]>;
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: "free" | "starter" | "pro" | "business";
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["organizations"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "owner" | "manager" | "buyer" | "sales" | "warehouse" | "viewer";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["memberships"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["memberships"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          lead_time_days: number;
          moq: number;
          currency: string;
          payment_terms: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["suppliers"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          organization_id: string;
          supplier_id: string | null;
          sku: string;
          name: string;
          description: string | null;
          unit_cost: number;
          selling_price: number;
          stock_on_hand: number;
          reorder_point: number;
          reorder_qty: number;
          lead_time_days: number | null;
          moq: number | null;
          status: "active" | "discontinued" | "draft";
          listed_online: boolean;
          abc_class: "A" | "B" | "C" | null;
          season_tags: string[];
          category: string | null;
          tags: string[];
          external_id: string | null;
          barcode: string | null;
          weight_kg: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          company: string | null;
          external_id: string | null;
          total_orders: number;
          total_spent: number;
          last_order_at: string | null;
          avg_order_interval_days: number | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customers"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      sales_orders: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string | null;
          order_number: string;
          status: "draft" | "pending" | "completed" | "cancelled" | "refunded";
          subtotal: number;
          discount_total: number;
          shipping_total: number;
          tax_total: number;
          total: number;
          platform: string | null;
          external_id: string | null;
          ordered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sales_orders"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["sales_orders"]["Insert"]>;
      };
      sales_order_items: {
        Row: {
          id: string;
          organization_id: string;
          order_id: string;
          product_id: string | null;
          sku: string;
          name: string;
          qty: number;
          unit_price: number;
          unit_cost: number;
          discount: number;
          total: number;
        };
        Insert: Omit<Database["public"]["Tables"]["sales_order_items"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["sales_order_items"]["Insert"]>;
      };
      purchase_orders: {
        Row: {
          id: string;
          organization_id: string;
          supplier_id: string | null;
          order_number: string;
          status: "draft" | "sent" | "confirmed" | "received" | "cancelled";
          subtotal: number;
          shipping: number;
          total: number;
          expected_at: string | null;
          received_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["purchase_orders"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Insert"]>;
      };
      inventory_snapshots: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          snapshot_date: string;
          stock_on_hand: number;
          stock_committed: number;
          stock_available: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory_snapshots"]["Row"], "id" | "created_at" | "stock_available"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["inventory_snapshots"]["Insert"]>;
      };
      product_metrics: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          calculated_at: string;
          avg_daily_sales_7d: number;
          avg_daily_sales_30d: number;
          avg_daily_sales_90d: number;
          days_of_cover: number;
          days_since_last_sale: number | null;
          last_sale_at: string | null;
          revenue_90d: number;
          units_sold_90d: number;
          real_unit_cost: number;
          real_margin_pct: number;
          avg_platform_fee: number;
          avg_discount: number;
          abc_class: "A" | "B" | "C" | null;
          cash_tied_up: number;
        };
        Insert: Omit<Database["public"]["Tables"]["product_metrics"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["product_metrics"]["Insert"]>;
      };
      decision_rules: {
        Row: {
          id: string;
          organization_id: string;
          rule_type: string;
          name: string;
          description: string | null;
          enabled: boolean;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["decision_rules"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["decision_rules"]["Insert"]>;
      };
      decision_alerts: {
        Row: {
          id: string;
          organization_id: string;
          rule_type: string;
          related_product_id: string | null;
          related_customer_id: string | null;
          related_supplier_id: string | null;
          severity: "red" | "orange" | "yellow" | "green";
          status: "pending" | "completed" | "snoozed" | "dismissed";
          title: string;
          summary: string;
          reasoning: string | null;
          suggested_action: string | null;
          suggested_value: number | null;
          suggested_qty: number | null;
          metadata: Json;
          snooze_until: string | null;
          dismissal_reason: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["decision_alerts"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["decision_alerts"]["Insert"]>;
      };
      integrations: {
        Row: {
          id: string;
          organization_id: string;
          provider: "shopify" | "xero" | "myob" | "amazon" | "ebay" | "square" | "lightspeed" | "csv" | "zapier";
          status: "active" | "error" | "disconnected";
          credentials_encrypted: string | null;
          shop_domain: string | null;
          last_sync_at: string | null;
          last_error: string | null;
          sync_config: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["integrations"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
      };
      data_provenance: {
        Row: {
          id: string;
          organization_id: string;
          table_name: string;
          record_id: string;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          source: "manual" | "shopify" | "xero" | "csv" | "rule" | "cron" | "api";
          changed_by: string | null;
          changed_at: string;
          notes: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["data_provenance"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["data_provenance"]["Insert"]>;
      };
    };
    Views: {};
    Functions: {
      get_user_org_ids: { Args: {}; Returns: string[] };
      calculate_product_metrics: { Args: { p_org_id: string }; Returns: number };
      seed_default_rules: { Args: { p_org_id: string }; Returns: void };
    };
    Enums: {};
  };
}

// Convenience type aliases
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Membership = Database["public"]["Tables"]["memberships"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type SalesOrder = Database["public"]["Tables"]["sales_orders"]["Row"];
export type SalesOrderItem = Database["public"]["Tables"]["sales_order_items"]["Row"];
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type ProductMetrics = Database["public"]["Tables"]["product_metrics"]["Row"];
export type DecisionRule = Database["public"]["Tables"]["decision_rules"]["Row"];
export type DecisionAlert = Database["public"]["Tables"]["decision_alerts"]["Row"];
export type Integration = Database["public"]["Tables"]["integrations"]["Row"];
export type DataProvenance = Database["public"]["Tables"]["data_provenance"]["Row"];

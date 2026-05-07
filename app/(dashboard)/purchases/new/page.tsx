import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { firstOf } from "@/lib/utils";
import { PoForm } from "@/components/purchases/po-form";

export const dynamic = "force-dynamic";

interface SearchParams {
  from_alert?: string;
  product?: string;
  supplier?: string;
}

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;

  // Fetch suppliers and active products for the form selects
  const [{ data: suppliers }, { data: productsRaw }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, lead_time_days, moq")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("products")
      .select(`
        id, sku, name, unit_cost, selling_price, supplier_id, moq, stock_on_hand,
        product_metrics ( avg_daily_sales_30d )
      `)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("name"),
  ]);

  // Flatten avg_daily_sales_30d onto each product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (productsRaw ?? []).map((p: any) => {
    const metrics = Array.isArray(p.product_metrics) ? p.product_metrics[0] : p.product_metrics;
    return {
      id: p.id as string,
      sku: p.sku as string,
      name: p.name as string,
      unit_cost: p.unit_cost as number,
      selling_price: p.selling_price as number,
      avg_daily_sales_30d: (metrics?.avg_daily_sales_30d as number) ?? 0,
      supplier_id: p.supplier_id as string | null,
      moq: p.moq as number | null,
      stock_on_hand: p.stock_on_hand as number,
    };
  });

  // Pre-fill from alert if query params provided
  let prefill: {
    alertId?: string;
    supplierId?: string;
    items?: Array<{ productId: string; sku: string; name: string; qty: number; unitCost: number }>;
  } = {};

  if (params.from_alert && params.product) {
    const [{ data: alert }, { data: product }] = await Promise.all([
      supabase
        .from("decision_alerts")
        .select("id, metadata, rule_type")
        .eq("id", params.from_alert)
        .single(),
      supabase
        .from("products")
        .select("id, sku, name, unit_cost, supplier_id, moq")
        .eq("id", params.product)
        .single(),
    ]);

    if (alert && product) {
      const meta = alert.metadata as Record<string, unknown>;
      const qty =
        (meta.suggested_qty as number | null) ??
        (meta.moq as number | null) ??
        1;

      prefill = {
        alertId: alert.id as string,
        supplierId: (meta.supplier_id as string | null) ?? (product.supplier_id as string | null) ?? undefined,
        items: [
          {
            productId: product.id as string,
            sku: product.sku as string,
            name: product.name as string,
            qty,
            unitCost: product.unit_cost as number,
          },
        ],
      };
    }
  } else if (params.product) {
    const { data: product } = await supabase
      .from("products")
      .select("id, sku, name, unit_cost, supplier_id, moq")
      .eq("id", params.product)
      .single();

    if (product) {
      prefill = {
        // explicit supplier param overrides the product's default supplier
        supplierId: params.supplier ?? (product.supplier_id as string | null) ?? undefined,
        items: [
          {
            productId: product.id as string,
            sku: product.sku as string,
            name: product.name as string,
            qty: (product.moq as number | null) ?? 1,
            unitCost: product.unit_cost as number,
          },
        ],
      };
    }
  } else if (params.supplier) {
    prefill = { supplierId: params.supplier };
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <PoForm
        suppliers={suppliers ?? []}
        products={products}
        prefill={prefill}
      />
    </div>
  );
}

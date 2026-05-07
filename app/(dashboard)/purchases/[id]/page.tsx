import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PoDetail } from "@/components/purchases/po-detail";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

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

  const { data: po } = await supabase
    .from("purchase_orders")
    .select(`
      id, order_number, status, subtotal, shipping, total,
      expected_at, received_at, notes, created_at, updated_at,
      supplier_id,
      suppliers ( id, name, contact_email, contact_name, lead_time_days )
    `)
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!po) notFound();

  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("id, product_id, sku, name, qty_ordered, qty_received, unit_cost, total")
    .eq("order_id", id)
    .order("created_at" as never);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <PoDetail po={po as never} items={items ?? []} />
    </div>
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const itemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  qty_ordered: z.number().int().min(1),
  unit_cost: z.number().min(0),
});

const schema = z.object({
  supplier_id: z.string().uuid().nullable().optional(),
  expected_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["draft", "sent"]).optional().default("draft"),
  items: z.array(itemSchema).min(1),
  from_alert_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { supplier_id, expected_at, notes, status, items, from_alert_id } = parsed.data;
  const orgId = membership.organization_id;
  const admin = createAdminClient();

  // Generate order number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await admin
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  const order_number = `PO-${today}-${seq}`;

  // Compute totals
  const subtotal = items.reduce((s, i) => s + i.qty_ordered * i.unit_cost, 0);

  const { data: po, error: poError } = await admin
    .from("purchase_orders")
    .insert({
      organization_id: orgId,
      supplier_id: supplier_id ?? null,
      order_number,
      status: status ?? "draft",
      subtotal,
      total: subtotal,
      expected_at: expected_at ?? null,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (poError || !po) {
    return NextResponse.json({ error: poError?.message ?? "Failed to create PO" }, { status: 500 });
  }

  const lineItems = items.map((i) => ({
    organization_id: orgId,
    order_id: po.id,
    product_id: i.product_id ?? null,
    sku: i.sku,
    name: i.name,
    qty_ordered: i.qty_ordered,
    qty_received: 0,
    unit_cost: i.unit_cost,
    total: i.qty_ordered * i.unit_cost,
  }));

  const { error: itemsError } = await admin.from("purchase_order_items").insert(lineItems);
  if (itemsError) {
    // Roll back PO if items fail
    await admin.from("purchase_orders").delete().eq("id", po.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Mark originating alert as complete
  if (from_alert_id) {
    await supabase
      .from("decision_alerts")
      .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: user.id })
      .eq("id", from_alert_id);
  }

  return NextResponse.json({ id: po.id, order_number });
}

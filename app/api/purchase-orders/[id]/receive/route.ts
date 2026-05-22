import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      qty_received: z.number().int().min(0),
    })
  ),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify membership before any data access
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, organization_id, status")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["confirmed", "sent"].includes(po.status as string)) {
    return NextResponse.json({ error: "PO must be confirmed or sent to receive" }, { status: 422 });
  }

  const orgId = po.organization_id as string;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data: existingItems } = await admin
    .from("purchase_order_items")
    .select("id, product_id, qty_ordered, qty_received")
    .eq("order_id", id);

  const itemMap = new Map((existingItems ?? []).map((i) => [i.id as string, i]));
  const affectedProductIds: string[] = [];

  for (const { item_id, qty_received } of parsed.data.items) {
    const existing = itemMap.get(item_id);
    if (!existing) continue;

    const delta = qty_received - (existing.qty_received as number);

    await admin
      .from("purchase_order_items")
      .update({ qty_received })
      .eq("id", item_id);

    if (existing.product_id && delta > 0) {
      const pid = existing.product_id as string;

      const { data: product } = await admin
        .from("products")
        .select("stock_on_hand")
        .eq("id", pid)
        .single();

      if (product) {
        const oldStock = product.stock_on_hand as number;
        const newStock = oldStock + delta;

        await admin
          .from("products")
          .update({ stock_on_hand: newStock })
          .eq("id", pid);

        // Snapshot today's stock level
        await admin
          .from("inventory_snapshots")
          .upsert(
            {
              organization_id: orgId,
              product_id: pid,
              snapshot_date: today,
              stock_on_hand: newStock,
            },
            { onConflict: "organization_id,product_id,snapshot_date" }
          );

        // Audit trail
        await admin.from("data_provenance").insert({
          organization_id: orgId,
          table_name: "products",
          record_id: pid,
          field_name: "stock_on_hand",
          old_value: String(oldStock),
          new_value: String(newStock),
          source: "manual",
          changed_by: user.id,
          notes: `Received via PO ${id}`,
        });

        affectedProductIds.push(pid);
      }
    }
  }

  // Mark PO as received
  await admin
    .from("purchase_orders")
    .update({ status: "received", received_at: now })
    .eq("id", id);

  // Complete any pending reorder alerts for the products received
  if (affectedProductIds.length > 0) {
    await admin
      .from("decision_alerts")
      .update({ status: "completed", completed_at: now, completed_by: user.id })
      .eq("organization_id", orgId)
      .eq("rule_type", "reorder")
      .in("related_product_id", affectedProductIds)
      .in("status", ["pending", "snoozed"]);
  }

  // Trigger metrics recalculation (best-effort — function may not be deployed)
  try {
    await admin.rpc("calculate_product_metrics" as never, { p_org_id: orgId } as never);
  } catch {
    // Silently ignore
  }

  return NextResponse.json({ success: true });
}

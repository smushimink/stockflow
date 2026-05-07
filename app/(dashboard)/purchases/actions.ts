"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function getOrgId(): Promise<{ orgId: string; userId: string }> {
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

  return { orgId: membership.organization_id, userId: user.id };
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "cancelled"],
  confirmed: ["received", "cancelled"],
  cancelled: ["draft"],
};

// ── Status transitions ────────────────────────────────────────────────────────

export async function markAsSent(poId: string) {
  return _transition(poId, "sent");
}

export async function markAsConfirmed(poId: string) {
  return _transition(poId, "confirmed");
}

export async function cancelOrder(poId: string) {
  return _transition(poId, "cancelled");
}

export async function reopenOrder(poId: string) {
  return _transition(poId, "draft");
}

async function _transition(poId: string, newStatus: string) {
  const { orgId } = await getOrgId();
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .eq("organization_id", orgId)
    .single();

  if (!po) throw new Error("PO not found");
  const allowed = ALLOWED_TRANSITIONS[po.status as string] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${po.status as string} to ${newStatus}`);
  }

  await supabase
    .from("purchase_orders")
    .update({ status: newStatus })
    .eq("id", poId);

  revalidatePath(`/purchases/${poId}`);
  revalidatePath("/purchases");
}

// ── Delete (draft only) ───────────────────────────────────────────────────────

export async function deletePurchaseOrder(poId: string) {
  const { orgId } = await getOrgId();
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .eq("organization_id", orgId)
    .single();

  if (!po) throw new Error("PO not found");
  if (po.status !== "draft") throw new Error("Only draft orders can be deleted");

  await supabase.from("purchase_orders").delete().eq("id", poId);

  revalidatePath("/purchases");
  redirect("/purchases");
}

// ── Mark as received ──────────────────────────────────────────────────────────

export async function markAsReceived(
  poId: string,
  itemQtys: Array<{ item_id: string; qty_received: number }>
) {
  const { orgId, userId } = await getOrgId();
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const { data: existingItems } = await admin
    .from("purchase_order_items")
    .select("id, product_id, qty_ordered, qty_received")
    .eq("order_id", poId);

  const itemMap = new Map((existingItems ?? []).map((i) => [i.id as string, i]));
  const affectedProductIds: string[] = [];

  for (const { item_id, qty_received } of itemQtys) {
    const existing = itemMap.get(item_id);
    if (!existing) continue;

    const delta = qty_received - (existing.qty_received as number);

    await admin.from("purchase_order_items").update({ qty_received }).eq("id", item_id);

    if (existing.product_id && delta > 0) {
      const pid = existing.product_id as string;
      const { data: product } = await admin.from("products").select("stock_on_hand").eq("id", pid).single();

      if (product) {
        const oldStock = product.stock_on_hand as number;
        const newStock = oldStock + delta;

        await admin.from("products").update({ stock_on_hand: newStock }).eq("id", pid);

        await admin.from("inventory_snapshots").upsert(
          { organization_id: orgId, product_id: pid, snapshot_date: today, stock_on_hand: newStock },
          { onConflict: "organization_id,product_id,snapshot_date" }
        );

        await admin.from("data_provenance").insert({
          organization_id: orgId,
          table_name: "products",
          record_id: pid,
          field_name: "stock_on_hand",
          old_value: String(oldStock),
          new_value: String(newStock),
          source: "manual",
          changed_by: userId,
          notes: `Received via PO ${poId}`,
        });

        affectedProductIds.push(pid);
      }
    }
  }

  await admin.from("purchase_orders").update({ status: "received", received_at: now }).eq("id", poId);

  if (affectedProductIds.length > 0) {
    await admin
      .from("decision_alerts")
      .update({ status: "completed", completed_at: now, completed_by: userId })
      .eq("organization_id", orgId)
      .eq("rule_type", "reorder")
      .in("related_product_id", affectedProductIds)
      .in("status", ["pending", "snoozed"]);
  }

  try {
    await admin.rpc("calculate_product_metrics" as never, { p_org_id: orgId } as never);
  } catch {
    // best-effort
  }

  revalidatePath(`/purchases/${poId}`);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Parse optional body (used by real_margin for custom price)
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine
  }

  const { data: alert, error: alertError } = await supabase
    .from("decision_alerts")
    .select("id, organization_id, rule_type, related_product_id, related_customer_id, suggested_value, metadata")
    .eq("id", id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // ── dead_stock: apply 50% clearance price ──────────────────────────────────
  if (alert.rule_type === "dead_stock" && alert.related_product_id && alert.suggested_value) {
    const { data: product } = await supabase
      .from("products")
      .select("selling_price")
      .eq("id", alert.related_product_id)
      .single();

    const { error: updateError } = await supabase
      .from("products")
      .update({ selling_price: alert.suggested_value })
      .eq("id", alert.related_product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from("data_provenance").insert({
      organization_id: alert.organization_id,
      table_name: "products",
      record_id: alert.related_product_id,
      field_name: "selling_price",
      old_value: String(product?.selling_price ?? ""),
      new_value: String(alert.suggested_value),
      source: "rule",
      changed_by: user.id,
      notes: `Dead stock rule: applied 50% clearance discount (alert ${id})`,
    });
  }

  // ── real_margin: apply suggested (or user-overridden) price ────────────────
  if (alert.rule_type === "real_margin" && alert.related_product_id) {
    const newPrice =
      typeof body.price === "number"
        ? body.price
        : (alert.suggested_value as number | null);

    if (newPrice != null) {
      const { data: product } = await supabase
        .from("products")
        .select("selling_price")
        .eq("id", alert.related_product_id)
        .single();

      const { error: updateError } = await supabase
        .from("products")
        .update({ selling_price: newPrice })
        .eq("id", alert.related_product_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await supabase.from("data_provenance").insert({
        organization_id: alert.organization_id,
        table_name: "products",
        record_id: alert.related_product_id,
        field_name: "selling_price",
        old_value: String(product?.selling_price ?? ""),
        new_value: String(newPrice),
        source: "rule",
        changed_by: user.id,
        notes: `Margin rule: price adjusted to ${newPrice} (alert ${id})`,
      });
    }
  }

  // ── customer_churn: append a contact note ─────────────────────────────────
  if (alert.rule_type === "customer_churn" && alert.related_customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("notes")
      .eq("id", alert.related_customer_id)
      .single();

    const timestamp = new Date().toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
    });
    const newEntry = `[${timestamp}] Called — marked as contacted via StockFlow alert`;
    const existing = (customer?.notes as string | null) ?? "";
    const updated = existing ? `${newEntry}\n\n${existing}` : newEntry;

    await supabase
      .from("customers")
      .update({ notes: updated })
      .eq("id", alert.related_customer_id);
  }

  // ── mark alert complete ────────────────────────────────────────────────────
  const { error } = await supabase
    .from("decision_alerts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

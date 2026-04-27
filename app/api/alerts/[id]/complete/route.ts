import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the alert and verify ownership
  const { data: alert, error: alertError } = await supabase
    .from("decision_alerts")
    .select("id, organization_id, rule_type, related_product_id, suggested_value, metadata")
    .eq("id", id)
    .single();

  if (alertError || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  // Handle rule-specific actions
  if (alert.rule_type === "dead_stock" && alert.related_product_id && alert.suggested_value) {
    // Fetch current price for audit
    const { data: product } = await supabase
      .from("products")
      .select("selling_price")
      .eq("id", alert.related_product_id)
      .single();

    // Apply 50% discount
    const { error: updateError } = await supabase
      .from("products")
      .update({ selling_price: alert.suggested_value })
      .eq("id", alert.related_product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit trail
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

  // Mark alert as completed
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

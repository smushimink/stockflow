import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["sent", "confirmed", "received", "cancelled", "draft"]),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "cancelled"],
  confirmed: ["received", "cancelled"],
  cancelled: ["draft"],
};

export async function PATCH(
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
    .select("id, status, organization_id")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[po.status as string] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${po.status} to ${parsed.data.status}` },
      { status: 422 }
    );
  }

  const updatePayload: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "received") {
    updatePayload.received_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update(updatePayload)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, status: parsed.data.status });
}

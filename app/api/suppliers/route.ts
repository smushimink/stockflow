import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, lead_time_days, moq, contact_email, contact_name")
    .eq("organization_id", membership.organization_id)
    .eq("active", true)
    .order("name");

  return NextResponse.json(suppliers ?? []);
}

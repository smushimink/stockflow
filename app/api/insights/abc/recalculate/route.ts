import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recalculateAbcClassification } from "@/lib/metrics/calculator";

export async function POST() {
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

  try {
    const count = await recalculateAbcClassification(membership.organization_id);
    return NextResponse.json({ classified: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recalculation failed" },
      { status: 500 }
    );
  }
}

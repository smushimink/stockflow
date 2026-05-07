import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runForecastEngine } from "@/lib/analytics/run-forecast-engine";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const result = await runForecastEngine(membership.organization_id as string);
  return NextResponse.json(result);
}

// Also allow GET so the insights page can ping it easily
export async function GET(req: NextRequest) {
  return POST(req);
}

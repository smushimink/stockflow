import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectSeasonality } from "@/lib/analytics/seasonality";

// Called weekly by Vercel Cron (Sunday 3am AEST = Saturday 17:00 UTC).
// Add to vercel.json:
//   { "crons": [{ "path": "/api/cron/detect-seasonality", "schedule": "0 17 * * 0" }] }

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: orgs } = await supabase.from("organizations").select("id, name");

  if (!orgs?.length) {
    return NextResponse.json({ processed: 0 });
  }

  const results = [];

  for (const org of orgs) {
    try {
      const result = await detectSeasonality(org.id as string);
      results.push({ org: org.name, ...result });
    } catch (err) {
      results.push({ org: org.name, error: (err as Error).message });
    }
  }

  return NextResponse.json({ processed: orgs.length, results });
}

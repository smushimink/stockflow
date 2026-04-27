import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runEngine } from "@/lib/decisions/engine";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name");

  if (!orgs?.length) {
    return NextResponse.json({ processed: 0 });
  }

  const results = [];
  for (const org of orgs) {
    const result = await runEngine(org.id);
    results.push({ org: org.name, ...result });
  }

  return NextResponse.json({ processed: orgs.length, results });
}

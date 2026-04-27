import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  reason: z.string().min(1).max(500),
  days: z.number().min(1).max(30).optional().default(7),
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

  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + parsed.data.days);

  const { error } = await supabase
    .from("decision_alerts")
    .update({
      status: "snoozed",
      snooze_until: snoozeUntil.toISOString(),
      dismissal_reason: parsed.data.reason,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, snooze_until: snoozeUntil.toISOString() });
}

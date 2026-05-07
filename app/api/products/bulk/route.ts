import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  product_ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["discount50", "discontinue"]),
});

export async function POST(request: Request) {
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

  const orgId = membership.organization_id;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { product_ids, action } = parsed.data;

  if (action === "discontinue") {
    const { error } = await supabase
      .from("products")
      .update({ status: "discontinued" })
      .eq("organization_id", orgId)
      .in("id", product_ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: product_ids.length });
  }

  // discount50: set selling_price = selling_price * 0.5 for each product
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, selling_price")
    .eq("organization_id", orgId)
    .in("id", product_ids);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  let updated = 0;
  for (const p of products ?? []) {
    const { error } = await supabase
      .from("products")
      .update({ selling_price: (p.selling_price as number) * 0.5 })
      .eq("id", p.id as string);

    if (!error) updated++;
  }

  return NextResponse.json({ updated });
}

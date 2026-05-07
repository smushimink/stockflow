"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const businessContextSchema = z.object({
  business_type: z.enum(["wholesale", "retail", "d2c", "mixed"]),
  industry: z.enum(["food_grocery", "beauty", "homeware", "apparel", "electronics", "industrial", "other"]),
  products_perishable: z.boolean(),
  avg_shelf_life_days: z.number().positive().nullable(),
  warehouse_size_sqm: z.number().positive().nullable(),
  warehouse_cost_monthly: z.number().nonnegative().nullable(),
  payment_terms_default_days: z.number().int().min(1).max(365),
  primary_currency: z.string().length(3),
  primary_country: z.string().min(2).max(3),
  active_seasons: z.array(z.string()),
  business_age_months: z.number().int().min(0),
  primary_sales_channels: z.array(z.string()),
  customer_concentration_risk_threshold: z.number().min(1).max(100),
  notes: z.string().max(1000),
});

export type BusinessContextInput = z.infer<typeof businessContextSchema>;

export async function saveBusinessContext(
  input: BusinessContextInput
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = businessContextSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const admin = createAdminClient();

  // Find user's org via membership
  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .limit(1)
    .single();

  if (!membership) return { error: "No organization found" };

  const { error } = await admin
    .from("organizations")
    .update({ business_context: parsed.data })
    .eq("id", membership.organization_id);

  if (error) return { error: error.message };
  return { success: true };
}

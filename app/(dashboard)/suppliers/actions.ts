"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  lead_time_days: z.number().int().min(0).optional(),
  moq: z.number().int().min(1).optional(),
  currency: z.string().min(1).max(10).optional(),
  payment_terms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export type SupplierUpdateFields = z.infer<typeof schema>;

export async function updateSupplier(
  supplierId: string,
  fields: SupplierUpdateFields
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) throw new Error("No org");

  const parsed = schema.parse(fields);

  const { error } = await supabase
    .from("suppliers")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", supplierId)
    .eq("organization_id", membership.organization_id);

  if (error) throw new Error(error.message);
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
}

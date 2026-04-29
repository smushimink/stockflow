"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createOrganization(name: string): Promise<{ orgId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select()
    .single();

  if (orgError) {
    return { error: orgError.message };
  }

  const { error: memberError } = await admin
    .from("memberships")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" });

  if (memberError) {
    return { error: memberError.message };
  }

  await admin.rpc("seed_default_rules", { p_org_id: org.id });

  return { orgId: org.id };
}

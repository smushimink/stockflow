"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function makeEntry(text: string): string {
  const ts = new Date().toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `[${ts}] ${text}`;
}

export async function addCustomerNote(customerId: string, text: string): Promise<void> {
  if (!text.trim()) return;

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

  const { data: customer } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", customerId)
    .eq("organization_id", membership.organization_id)
    .single();
  if (!customer) throw new Error("Customer not found");

  const existing = (customer.notes as string | null) ?? "";
  const entry = makeEntry(text.trim());
  const updated = existing ? existing + "\n---\n" + entry : entry;

  const { error } = await supabase
    .from("customers")
    .update({ notes: updated, updated_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("organization_id", membership.organization_id);

  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${customerId}`);
}

export async function markCustomerContacted(customerId: string): Promise<void> {
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

  const orgId = membership.organization_id;
  const now = new Date().toISOString();

  // Append note
  const { data: customer } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", customerId)
    .eq("organization_id", orgId)
    .single();
  if (!customer) throw new Error("Customer not found");

  const existing = (customer.notes as string | null) ?? "";
  const entry = makeEntry("Marked as contacted");
  const updated = existing ? existing + "\n---\n" + entry : entry;

  const { error: noteError } = await supabase
    .from("customers")
    .update({ notes: updated, updated_at: now })
    .eq("id", customerId)
    .eq("organization_id", orgId);
  if (noteError) throw new Error(noteError.message);

  // Complete pending churn alerts for this customer
  await supabase
    .from("decision_alerts")
    .update({ status: "completed", completed_at: now, completed_by: user.id })
    .eq("organization_id", orgId)
    .eq("related_customer_id", customerId)
    .eq("rule_type", "customer_churn")
    .in("status", ["pending", "snoozed"]);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

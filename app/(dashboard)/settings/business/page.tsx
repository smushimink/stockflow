import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BUSINESS_CONTEXT } from "@/lib/decisions/types";
import type { BusinessContext } from "@/lib/decisions/types";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { redirect } from "next/navigation";

export const metadata = { title: "Business profile · ArachNet" };

export default async function BusinessProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  let businessContext: BusinessContext = DEFAULT_BUSINESS_CONTEXT;

  if (membership) {
    const { data: org } = await admin
      .from("organizations")
      .select("business_context")
      .eq("id", membership.organization_id)
      .single();

    if (org?.business_context) {
      businessContext = {
        ...DEFAULT_BUSINESS_CONTEXT,
        ...(org.business_context as Partial<BusinessContext>),
      };
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-600 text-[#1A1A17]">Business profile</h1>
        <p className="mt-1 text-sm text-[#6B6B66]">
          These settings shape how ArachNet's decision rules are calibrated for your business.
          An Asian grocer has different dead stock thresholds than a homeware importer.
        </p>
      </div>

      <div className="rounded-xl border border-[#E5E5E2] bg-white p-6">
        <BusinessProfileForm initialValues={businessContext} />
      </div>
    </div>
  );
}

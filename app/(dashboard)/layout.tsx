import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shared/sidebar";
import { CommandPalette } from "@/components/shared/command-palette";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get org context
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  const orgId = membership.organization_id;

  // Counts for sidebar badges
  const [{ count: urgentCount }, { count: productCount }] = await Promise.all([
    supabase
      .from("decision_alerts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .eq("severity", "red"),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        urgentCount={urgentCount ?? 0}
        productCount={productCount ?? 0}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-y-auto bg-[#F7F7F5]">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

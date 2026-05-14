import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { stripe, PLAN_META } from "@/lib/stripe/server";

export const metadata = { title: "Subscription activated · ArachNet" };

interface Props {
  searchParams: Promise<{ session_id?: string; plan?: string }>;
}

export default async function BillingSuccessPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { session_id, plan: planParam } = await searchParams;

  type PlanKey = "starter" | "pro" | "business";
  const planKey = (planParam ?? "starter") as PlanKey;
  const validPlan = planKey in PLAN_META ? planKey : "starter";

  // Fetch Stripe session for billing details
  let nextBillingDate: string | null = null;
  const planLabel = PLAN_META[validPlan].label;
  const fullMonthlyUsd = PLAN_META[validPlan].fullMonthlyUsd;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["subscription.items"],
      });

      const sub = session.subscription as import("stripe").Stripe.Subscription | null;
      if (sub) {
        // current_period_end is on SubscriptionItem in Stripe v22+
        const periodEnd = sub.items.data[0]?.current_period_end;
        if (periodEnd) {
          nextBillingDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
      }
    } catch {
      // Non-fatal — show generic success without billing details
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-5 py-20">
      <div className="w-full max-w-md text-center space-y-8">

        {/* Checkmark */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "#F2F8F0", border: "1px solid rgba(77,123,61,0.2)" }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14l6 6 12-12"
              stroke="#3E7A2E"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#1A1A17] tracking-tight">
            You&apos;re in.
          </h1>
          <p className="text-[#6B6B66]">
            Your first decision email arrives tomorrow at 7am.
          </p>
        </div>

        {/* Plan details card */}
        <div
          className="rounded-xl border text-left p-5 space-y-3"
          style={{ background: "white", borderColor: "#E5E5E2" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#1A1A17]">{planLabel} plan</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#F2F8F0", color: "#3E7A2E" }}
            >
              Active
            </span>
          </div>

          <div className="border-t border-[#F0F0EE] pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B6B66]">This month</span>
              <span className="font-medium text-[#1A1A17]">$1.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B6B66]">From next month</span>
              <span className="font-medium text-[#1A1A17]">${fullMonthlyUsd}/mo</span>
            </div>
            {nextBillingDate && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6B6B66]">Next billing date</span>
                <span className="font-medium text-[#1A1A17]">{nextBillingDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/today"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-colors"
          style={{ background: "#1A1A17" }}
        >
          Go to dashboard →
        </Link>

        <p className="text-xs text-[#9B9B96]">
          Manage your subscription anytime in{" "}
          <Link href="/settings/billing" className="underline hover:text-[#6B6B66]">
            billing settings
          </Link>
          .
        </p>

      </div>
    </div>
  );
}

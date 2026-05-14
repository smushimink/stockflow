import { CheckCircle2 } from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { PricingCta } from "@/components/marketing/pricing-cta";

export const metadata = {
  title: "Pricing — ArachNet",
  description: "Start for $1 your first month. Then $99–$599/mo depending on your plan.",
};

const PLANS = [
  {
    key: "starter" as const,
    name: "Starter",
    fullPrice: "$99",
    features: [
      "1 connected source",
      "Up to 500 SKUs",
      "All 8 decision rules",
      "Daily email digest",
      "Email support",
    ],
    highlight: false,
    badge: null,
  },
  {
    key: "pro" as const,
    name: "Pro",
    fullPrice: "$249",
    features: [
      "3 connected sources",
      "Up to 5,000 SKUs",
      "All 8 rules + analytics",
      "Custom decision rules",
      "5 users",
      "Priority support",
    ],
    highlight: true,
    badge: "Most popular",
  },
  {
    key: "business" as const,
    name: "Business",
    fullPrice: "$599",
    features: [
      "Unlimited sources & SKUs",
      "Custom integrations",
      "20 users",
      "Phone + Slack support",
      "Dedicated onboarding session",
    ],
    highlight: false,
    badge: null,
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#F7F7F5] pt-14">
        <div className="max-w-5xl mx-auto px-5 py-20">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-[#4D7B3D] uppercase mb-4">
              Pricing
            </p>
            <h1 className="text-4xl font-bold text-[#1A1A17] tracking-tight mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-[17px] text-[#5C5C57] max-w-xl mx-auto">
              First month just $1. No commitment. Cancel anytime.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="rounded-2xl border flex flex-col"
                style={{
                  background: plan.highlight ? "#1A1A17" : "white",
                  borderColor: plan.highlight ? "#1A1A17" : "#E5E5E2",
                  padding: "28px",
                }}
              >
                {/* Badge */}
                <div className="h-6 mb-3">
                  {plan.badge && (
                    <span
                      className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: "#F0F0EE", color: "#1A1A17" }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Name */}
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: plan.highlight ? "#B5B2A9" : "#6B6B66" }}
                >
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mb-1">
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ color: plan.highlight ? "white" : "#1A1A17" }}
                  >
                    $1
                  </span>
                  <span
                    className="text-sm ml-1"
                    style={{ color: plan.highlight ? "#B5B2A9" : "#6B6B66" }}
                  >
                    first month
                  </span>
                </div>
                <p
                  className="text-sm mb-7"
                  style={{ color: plan.highlight ? "#8A877D" : "#9B9B96" }}
                >
                  then {plan.fullPrice}/mo
                </p>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2
                        size={15}
                        className="shrink-0 mt-0.5"
                        style={{ color: plan.highlight ? "#4D7B3D" : "#4D7B3D" }}
                      />
                      <span style={{ color: plan.highlight ? "#D8D5CE" : "#3C3C39" }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <PricingCta planKey={plan.key} highlight={plan.highlight} />
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-center text-sm text-[#6B6B66] mt-10">
            All plans start at $1 for the first month. No contracts. Cancel anytime.{" "}
            <span className="text-[#1A1A17] font-medium">Annual billing saves 20%.</span>
          </p>

        </div>
      </main>
    </>
  );
}

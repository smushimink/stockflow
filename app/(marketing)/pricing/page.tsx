import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export const metadata = {
  title: "Pricing — Stockflow",
  description: "Simple, transparent pricing for wholesale and distribution businesses.",
};

const PLANS = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    description: "For businesses getting started with inventory intelligence.",
    features: [
      "Up to 500 SKUs",
      "5 decision rules",
      "Daily action feed",
      "CSV import",
      "Email support",
    ],
    cta: "Start free trial",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$349",
    period: "/mo",
    description: "For growing businesses that need the full decision engine.",
    features: [
      "Up to 5,000 SKUs",
      "All 10 decision rules",
      "ABC-XYZ classification",
      "Xero & MYOB integration",
      "Supplier + customer analytics",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Business",
    price: "$799",
    period: "/mo",
    description: "For established distributors with complex operations.",
    features: [
      "Unlimited SKUs",
      "Everything in Pro",
      "Custom decision rules",
      "API access",
      "Dedicated onboarding",
      "SLA guarantee",
    ],
    cta: "Talk to us",
    href: "/contact",
    highlight: false,
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
            <p className="text-xs font-600 tracking-widest text-[#4D7B3D] uppercase mb-4">Pricing</p>
            <h1 className="text-4xl font-700 text-[#1A1A17] tracking-tight mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-[17px] text-[#5C5C57] max-w-xl mx-auto">
              All plans include a 14-day free trial. No credit card required. Cancel anytime.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="rounded-2xl border p-7 flex flex-col"
                style={{
                  background: plan.highlight ? "#1A1A17" : "#FFFFFF",
                  borderColor: plan.highlight ? "#1A1A17" : "#E5E5E2",
                }}
              >
                <p
                  className="text-xs font-600 tracking-widest uppercase mb-3"
                  style={{ color: plan.highlight ? "#9A9A93" : "#9A9A93" }}
                >
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span
                    className="text-4xl font-700 tracking-tight"
                    style={{ color: plan.highlight ? "#FFFFFF" : "#1A1A17" }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: plan.highlight ? "#9A9A93" : "#5C5C57" }}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className="text-[13px] leading-relaxed mb-6"
                  style={{ color: plan.highlight ? "#9A9A93" : "#5C5C57" }}
                >
                  {plan.description}
                </p>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: plan.highlight ? "#4D7B3D" : "#4D7B3D" }}
                      />
                      <span
                        className="text-[13px]"
                        style={{ color: plan.highlight ? "#E5E5E2" : "#1A1A17" }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className="block text-center py-2.5 rounded-lg text-sm font-500 transition-colors"
                  style={
                    plan.highlight
                      ? { background: "#FFFFFF", color: "#1A1A17" }
                      : { background: "#1A1A17", color: "#FFFFFF" }
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* FAQ note */}
          <p className="text-center text-[13px] text-[#9A9A93] mt-10">
            Questions?{" "}
            <Link href="/contact" className="text-[#1A1A17] underline underline-offset-2">
              Talk to us
            </Link>{" "}
            or{" "}
            <Link href="/#faq" className="text-[#1A1A17] underline underline-offset-2">
              read the FAQ
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}

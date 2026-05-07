import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Lock,
  AlertTriangle,
  UserMinus,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFaq } from "@/components/marketing/marketing-faq";

// ── Design tokens (used as inline styles / Tailwind arbitrary values) ─────────
// bg:      #F7F7F5
// surface: #FFFFFF
// ink:     #1A1A17
// ink-2:   #5C5C57
// ink-3:   #9A9A93
// border:  #E5E5E2
// green:   #4D7B3D
// orange:  #B47214
// red:     #C54632

// ── Mock action card for hero ─────────────────────────────────────────────────

function MockActionCard({
  severity,
  title,
  sub,
}: {
  severity: "red" | "orange" | "yellow";
  title: string;
  sub: string;
}) {
  const dot = severity === "red" ? "#C54632" : severity === "orange" ? "#B47214" : "#B47214";
  const bg = severity === "red" ? "#FDF2F0" : severity === "orange" ? "#FDF8EE" : "#FFFFFF";
  const border = severity === "red" ? "#C54632" : "#B47214";

  return (
    <div
      className="rounded-lg px-3.5 py-3 flex items-start gap-2.5"
      style={{ background: bg, border: `1px solid ${border}22` }}
    >
      <div
        className="w-2 h-2 rounded-full mt-1 shrink-0"
        style={{ background: dot }}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-500 text-[#1A1A17] leading-snug">{title}</p>
        <p className="text-[11px] text-[#6B6B66] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Hero mockup ───────────────────────────────────────────────────────────────

function HeroMockup() {
  return (
    <div
      className="relative select-none"
      style={{ transform: "perspective(1200px) rotateY(-4deg) rotateX(2deg)" }}
      aria-hidden="true"
    >
      <div
        className="rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: "#F7F7F5",
          border: "1px solid #E5E5E2",
          boxShadow: "0 24px 64px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        {/* Fake browser chrome */}
        <div
          className="px-4 py-3 flex items-center gap-2 border-b"
          style={{ background: "#FFFFFF", borderColor: "#E5E5E2" }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#C54632" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#B47214" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#4D7B3D" }} />
          </div>
          <div
            className="flex-1 mx-4 rounded text-[11px] text-center"
            style={{ background: "#F7F7F5", color: "#9A9A93", padding: "2px 8px" }}
          >
            app.stockflow.io/today
          </div>
        </div>

        {/* Fake app header */}
        <div className="px-4 pt-4 pb-2" style={{ background: "#F7F7F5" }}>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="text-[11px] font-600 text-[#9A9A93] uppercase tracking-wider">
                Mon 28 Apr
              </p>
              <p className="text-[17px] font-600 text-[#1A1A17]">Today&apos;s decisions</p>
            </div>
            <span
              className="text-[11px] font-500 px-2 py-0.5 rounded-full"
              style={{ background: "#FDF2F0", color: "#C54632" }}
            >
              6 urgent
            </span>
          </div>

          <div className="space-y-2">
            <MockActionCard
              severity="red"
              title="Reorder Sesame Oil — 240 units · $2,880"
              sub="3.2 days of cover left · avg 74/day · lead time 12d"
            />
            <MockActionCard
              severity="red"
              title="Liquidate 3 dead-stock SKUs · free $4,200"
              sub="58-91 days idle · apply 50% off in one click"
            />
            <MockActionCard
              severity="orange"
              title="Pricing opportunity: Rice Vinegar 500mL"
              sub="ε = −0.8 (inelastic) · +$410/month at recommended price"
            />
            <MockActionCard
              severity="orange"
              title="Call Wong Foods · 45 days quiet"
              sub="Avg interval 20d · $40,800/year customer · at risk"
            />
            <div className="flex items-center gap-2 py-1 opacity-40">
              <div className="flex-1 h-px" style={{ background: "#E5E5E2" }} />
              <p className="text-[10px] text-[#9A9A93]">2 more ↓</p>
              <div className="flex-1 h-px" style={{ background: "#E5E5E2" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <p className="text-center text-[11px] mt-3" style={{ color: "#9A9A93" }}>
        Mon 28 Apr, 7:00 AM — María&apos;s actual workspace
      </p>
    </div>
  );
}

// ── Severity dot ──────────────────────────────────────────────────────────────

function SevDot({ color }: { color: string }) {
  return (
    <div
      className="w-2 h-2 rounded-full shrink-0 mt-0.5"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  id,
  className = "",
  style,
  children,
}: {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`py-20 px-5 ${className}`} style={style}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

function SectionTitle({
  children,
  centered,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <h2
      className={`text-[32px] font-600 text-[#1A1A17] leading-tight mb-4 ${centered ? "text-center" : ""}`}
    >
      {children}
    </h2>
  );
}

// ── Pricing card ──────────────────────────────────────────────────────────────

function PricingCard({
  name,
  price,
  sub,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  price: string;
  sub: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5 relative"
      style={{
        background: highlight ? "#1A1A17" : "#FFFFFF",
        border: highlight ? "none" : "1px solid #E5E5E2",
        boxShadow: highlight ? "0 8px 32px rgba(0,0,0,0.14)" : "none",
      }}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className="text-[11px] font-600 px-3 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "#4D7B3D", color: "#FFFFFF" }}
          >
            Most popular
          </span>
        </div>
      )}
      <div>
        <p
          className="text-[13px] font-500 uppercase tracking-wider mb-2"
          style={{ color: highlight ? "#9A9A93" : "#6B6B66" }}
        >
          {name}
        </p>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[36px] font-600 leading-none"
            style={{ color: highlight ? "#FFFFFF" : "#1A1A17" }}
          >
            {price}
          </span>
          <span
            className="text-[13px]"
            style={{ color: highlight ? "#9A9A93" : "#6B6B66" }}
          >
            /month
          </span>
        </div>
        <p
          className="text-[12px] mt-1"
          style={{ color: highlight ? "#9A9A93" : "#9A9A93" }}
        >
          {sub}
        </p>
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2
              size={14}
              className="mt-0.5 shrink-0"
              style={{ color: highlight ? "#4D7B3D" : "#4D7B3D" }}
            />
            <span
              className="text-[13px]"
              style={{ color: highlight ? "#C8C8C4" : "#5C5C57" }}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className="block text-center py-2.5 rounded-lg text-[14px] font-500 transition-colors"
        style={{
          background: highlight ? "#FFFFFF" : "#1A1A17",
          color: highlight ? "#1A1A17" : "#FFFFFF",
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect("/today");

  return (
    <>
      {/* Skip to content */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-500"
        style={{ background: "#1A1A17", color: "#FFFFFF" }}
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main">
        {/* ── 2. HERO ─────────────────────────────────────────────────────── */}
        <section
          className="pt-[80px] pb-24 px-5"
          style={{
            background: "linear-gradient(160deg, #F7F7F5 0%, #F2F0EC 100%)",
          }}
        >
          <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div className="space-y-6">
              <div>
                <span
                  className="inline-block text-[12px] font-500 px-2.5 py-1 rounded-full mb-4"
                  style={{ background: "#E5E5E2", color: "#5C5C57" }}
                >
                  For product-based businesses doing $1M–$20M
                </span>
                <h1
                  className="text-[44px] sm:text-[52px] font-600 text-[#1A1A17] leading-[1.1] tracking-tight"
                >
                  Stop guessing what to buy, what to discount, who to chase.
                </h1>
              </div>
              <p
                className="text-[18px] leading-relaxed max-w-[540px]"
                style={{ color: "#5C5C57" }}
              >
                Stockflow turns your inventory data into a daily list of decisions — what to
                reorder, what&apos;s tying up cash, which customers are slipping. No dashboards to
                interpret. Just actions.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="px-5 py-3 rounded-lg text-[15px] font-500 text-white transition-colors"
                  style={{ background: "#1A1A17" }}
                >
                  Start 14-day free trial
                </Link>
                <Link
                  href="/tour"
                  className="px-5 py-3 rounded-lg text-[15px] font-500 border transition-colors"
                  style={{
                    color: "#1A1A17",
                    borderColor: "#C8C8C4",
                    background: "transparent",
                  }}
                >
                  See a 90-second tour →
                </Link>
              </div>

              <p className="text-[13px]" style={{ color: "#9A9A93" }}>
                Connect Shopify or upload a CSV. First decisions in your inbox by tomorrow.
              </p>
            </div>

            {/* Right — mockup */}
            <div className="flex justify-center md:justify-end">
              <div className="w-full max-w-[480px]">
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. THE PROBLEM ──────────────────────────────────────────────── */}
        <Section>
          <SectionTitle centered>If you run a product business, you&apos;ve felt all three.</SectionTitle>

          <div className="grid sm:grid-cols-3 gap-5 mt-10">
            {/* Card 1 */}
            <div
              className="rounded-xl p-6 space-y-3"
              style={{ background: "#FFFFFF", border: "1px solid #E5E5E2" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "#FDF2F0" }}
              >
                <Lock size={18} color="#C54632" />
              </div>
              <h3 className="text-[18px] font-600 text-[#1A1A17] leading-snug">
                $30k sitting in stock that hasn&apos;t moved in months.
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "#5C5C57" }}>
                You know it intuitively. You can&apos;t quantify it. Every reorder feels like a
                guess. Every spreadsheet update is half a day of work.
              </p>
            </div>

            {/* Card 2 */}
            <div
              className="rounded-xl p-6 space-y-3"
              style={{ background: "#FFFFFF", border: "1px solid #E5E5E2" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "#FDF8EE" }}
              >
                <AlertTriangle size={18} color="#B47214" />
              </div>
              <h3 className="text-[18px] font-600 text-[#1A1A17] leading-snug">
                Your top revenue product has 6% margin.
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "#5C5C57" }}>
                You don&apos;t realize until accounting closes the quarter. By then you&apos;ve
                ordered three more pallets.
              </p>
            </div>

            {/* Card 3 */}
            <div
              className="rounded-xl p-6 space-y-3"
              style={{ background: "#FFFFFF", border: "1px solid #E5E5E2" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "#F7F7F5" }}
              >
                <UserMinus size={18} color="#5C5C57" />
              </div>
              <h3 className="text-[18px] font-600 text-[#1A1A17] leading-snug">
                Your $40k/year client hasn&apos;t ordered in 50 days. Nobody noticed.
              </h3>
              <p className="text-[14px] leading-relaxed" style={{ color: "#5C5C57" }}>
                You&apos;d have called them on day 25 if anyone had told you. By the time you do,
                they&apos;re already buying from someone else.
              </p>
            </div>
          </div>

          <p
            className="text-center text-[15px] mt-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "#5C5C57" }}
          >
            These aren&apos;t problems of effort. They&apos;re problems of visibility. Stockflow
            turns visibility into action — automatically, every morning.
          </p>
        </Section>

        {/* ── 4. THE OUTCOME ──────────────────────────────────────────────── */}
        <Section style={{ background: "#FFFFFF" } as React.CSSProperties} className="bg-white">
          <SectionTitle centered>What you get instead.</SectionTitle>

          {/* Large mockup screenshot */}
          <div className="mt-8 max-w-[1100px] mx-auto">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid #E5E5E2",
                boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
              }}
              role="img"
              aria-label="Screenshot of Stockflow's Today screen showing prioritised decision cards"
            >
              {/* Fake browser chrome */}
              <div
                className="px-4 py-2.5 flex items-center gap-2 border-b"
                style={{ background: "#F7F7F5", borderColor: "#E5E5E2" }}
                aria-hidden="true"
              >
                <div className="flex gap-1.5">
                  {["#C54632", "#B47214", "#4D7B3D"].map((c) => (
                    <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <div
                  className="text-[11px] px-3 py-0.5 rounded mx-4"
                  style={{ background: "#FFFFFF", color: "#9A9A93", border: "1px solid #E5E5E2" }}
                >
                  app.stockflow.io/today
                </div>
              </div>

              {/* App mockup body */}
              <div className="p-6 space-y-3" style={{ background: "#F7F7F5" }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-600 uppercase tracking-wider" style={{ color: "#9A9A93" }}>
                      Mon 28 Apr · 7:00 AM
                    </p>
                    <p className="text-[22px] font-600 text-[#1A1A17]">Today&apos;s decisions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-500 px-2.5 py-1 rounded-full" style={{ background: "#FDF2F0", color: "#C54632" }}>
                      3 urgent
                    </span>
                    <span className="text-[12px] font-500 px-2.5 py-1 rounded-full" style={{ background: "#FDF8EE", color: "#B47214" }}>
                      2 this week
                    </span>
                    <span className="text-[12px] font-500 px-2.5 py-1 rounded-full" style={{ background: "#F2F8F0", color: "#4D7B3D" }}>
                      1 monitor
                    </span>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {[
                    { sev: "#C54632", bg: "#FDF2F0", title: "Reorder Sesame Oil — 240 units", sub: "3.2 days of cover · 74/day avg · combine with Supplier B to save $120 shipping" },
                    { sev: "#C54632", bg: "#FDF2F0", title: "3 dead-stock SKUs — clear $4,200", sub: "58–91 days idle · 50% off applied in one click · your cost recovered at 40 units" },
                    { sev: "#B47214", bg: "#FDF8EE", title: "Rice Vinegar 500mL — price too low", sub: "ε = −0.8 · inelastic · +$410/month at $4.80 vs current $4.20" },
                    { sev: "#B47214", bg: "#FDF8EE", title: "Wong Foods — 45 days quiet", sub: "Avg interval 20d · $40,800/yr revenue · call before they switch" },
                    { sev: "#6B6B66", bg: "#F7F7F5", title: "ABC Supplier — lead time creeping", sub: "Avg 14d promised, 21d actual · on-time rate 58% · fill rate 91%" },
                    { sev: "#4D7B3D", bg: "#F2F8F0", title: "3 SKUs not yet listed on Shopify", sub: "All class A · margin >28% · healthy stock · estimated $3,200/month uplift" },
                  ].map((card, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3.5 py-3 flex items-start gap-2.5"
                      style={{ background: card.bg, border: `1px solid ${card.sev}22` }}
                    >
                      <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: card.sev }} />
                      <div>
                        <p className="text-[13px] font-500 text-[#1A1A17]">{card.title}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#6B6B66" }}>{card.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-center text-[13px] mt-3" style={{ color: "#9A9A93" }}>
              Every morning at 7am, one email. One scroll. Six decisions, ranked by urgency, with the math behind each one.
            </p>
          </div>

          {/* Bullets */}
          <div className="mt-8 max-w-lg mx-auto space-y-3">
            {[
              "Reorder X units of Y by Friday — combine with supplier Z to save $120 shipping",
              "Drop these 3 dead SKUs to clear $4,200 of cash — apply 50% off in one click",
              "Wong Foods is at risk — they normally order every 20 days, now 45. Mark called when done.",
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#4D7B3D" }} />
                <p className="text-[14px] leading-relaxed" style={{ color: "#1A1A17" }}>{line}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 5. HOW IT WORKS ─────────────────────────────────────────────── */}
        <Section>
          <SectionTitle centered>From signup to first decision in under 24 hours.</SectionTitle>

          <div className="grid sm:grid-cols-3 gap-8 mt-12 relative">
            {/* Connecting line desktop */}
            <div
              className="hidden sm:block absolute top-8 left-[calc(16.7%+16px)] right-[calc(16.7%+16px)] h-px"
              style={{ background: "#E5E5E2" }}
              aria-hidden="true"
            />

            {[
              {
                n: "1",
                title: "Connect",
                body: "Plug into Shopify, Xero, or upload a CSV. We auto-map your columns even if they're in Spanish, Mandarin, or your accountant's freestyle.",
                sub: "5 minutes. No IT required.",
              },
              {
                n: "2",
                title: "Calibrate",
                body: "Tell us about your business — perishable or not, payment terms, seasons that matter. Set thresholds you can change anytime.",
                sub: "10 minutes. Your defaults will be sensible.",
              },
              {
                n: "3",
                title: "Decide",
                body: "Tomorrow morning, your first list of actions arrives. Reorders, discounts, customer outreach, supplier issues — all ranked, all explained, all actionable in one click.",
                sub: "Daily. Forever. Until you cancel — most don't.",
              },
            ].map((step) => (
              <div key={step.n} className="flex flex-col items-center text-center space-y-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[18px] font-600 z-10"
                  style={{ background: "#1A1A17", color: "#FFFFFF" }}
                >
                  {step.n}
                </div>
                <div className="space-y-2">
                  <h3 className="text-[20px] font-600 text-[#1A1A17]">{step.title}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#5C5C57" }}>
                    {step.body}
                  </p>
                  <p className="text-[13px]" style={{ color: "#9A9A93" }}>
                    {step.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 6. THE 8 DECISIONS ──────────────────────────────────────────── */}
        <Section id="decisions" className="bg-white">
          <div className="text-center mb-10">
            <SectionTitle>Eight questions Stockflow answers every day.</SectionTitle>
            <p className="text-[15px]" style={{ color: "#5C5C57" }}>
              Eight blind spots closed.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { dot: "#C54632", q: "What should I reorder today?", a: "We track sales velocity, lead times, and seasonality to flag stockouts before they happen." },
              { dot: "#C54632", q: "What's tying up my cash?", a: "Dead stock, slow movers, and cash trapped in inventory — quantified to the dollar." },
              { dot: "#B47214", q: "Are my prices right?", a: "Elasticity analysis from your own price history surfaces where you're leaving money on the table." },
              { dot: "#B47214", q: "Which products actually make me money?", a: "Real margin per SKU including shipping, fees, discounts. Best-sellers ranked by profit, not revenue." },
              { dot: "#B47214", q: "Which customers are profitable?", a: "Lifetime value, true margin per customer, and slow-payer detection. Identifies hidden gems." },
              { dot: "#B47214", q: "Are my suppliers reliable?", a: "Lead time accuracy, fill rate, defect rate. Plus cost-trend tracking so you spot stealth price hikes." },
              { dot: "#B47214", q: "What's coming next season?", a: "Seasonal patterns detected from your sales history. Pre-order alerts 90 days before each peak." },
              { dot: "#4D7B3D", q: "What should I list online?", a: "Surfaces high-margin SKUs with healthy stock that aren't yet on Shopify, Amazon, eBay." },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-xl p-5 space-y-2.5"
                style={{ background: "#F7F7F5", border: "1px solid #E5E5E2" }}
              >
                <div className="flex items-center gap-2">
                  <SevDot color={card.dot} />
                  <h3 className="text-[15px] font-600 text-[#1A1A17] leading-snug">{card.q}</h3>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "#5C5C57" }}>
                  {card.a}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-[13px] mt-8" style={{ color: "#9A9A93" }}>
            Each decision shows the math behind it. Each threshold is editable from the alert
            itself. The system explains. You decide.
          </p>
        </Section>

        {/* ── 7. WHY THIS, NOT THAT ───────────────────────────────────────── */}
        <Section>
          <SectionTitle centered>
            Built for businesses your size, not Walmart&apos;s.
          </SectionTitle>

          <div
            className="mt-8 rounded-xl overflow-hidden"
            style={{ border: "1px solid #E5E5E2" }}
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "#F7F7F5", borderBottom: "1px solid #E5E5E2" }}>
                  <th className="text-left px-5 py-3 font-600 text-[#9A9A93] w-[28%]" />
                  <th className="px-5 py-3 font-600 text-[#1A1A17] text-center">Stockflow</th>
                  <th className="px-5 py-3 font-500 text-[#5C5C57] text-center hidden sm:table-cell">
                    Enterprise tools
                    <br />
                    <span className="text-[11px] font-400 text-[#9A9A93]">(Blue Yonder, RELEX, o9)</span>
                  </th>
                  <th className="px-5 py-3 font-500 text-[#5C5C57] text-center hidden sm:table-cell">Spreadsheets</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Setup time", "1 day", "6–12 months", "None — you build it"],
                  ["Annual cost", "$1,200–$5,000", "$200,000+", "$0 (your time)"],
                  ["Multilingual import", "Yes (auto-mapped)", "English-only", "Manual"],
                  ["Rules editable in place", "Yes", "Submit a ticket", "Edit the formula"],
                  ["Designed for", "$1M–$20M businesses", "$500M+ businesses", "One-person heroes"],
                  ["Math behind decisions", "Visible, explained", "Black box", "Whatever you wrote"],
                  ["Daily action emails", "Yes", "No", "No"],
                ].map(([label, sf, ent, ss], i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < 6 ? "1px solid #E5E5E2" : "none",
                      background: i % 2 === 0 ? "#FFFFFF" : "#FAFAF9",
                    }}
                  >
                    <td className="px-5 py-3 font-500 text-[#1A1A17]">{label}</td>
                    <td className="px-5 py-3 text-center font-500" style={{ color: "#4D7B3D" }}>
                      {sf}
                    </td>
                    <td className="px-5 py-3 text-center hidden sm:table-cell" style={{ color: "#5C5C57" }}>
                      {ent}
                    </td>
                    <td className="px-5 py-3 text-center hidden sm:table-cell" style={{ color: "#5C5C57" }}>
                      {ss}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p
            className="text-center text-[14px] mt-6 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "#5C5C57" }}
          >
            Stockflow won&apos;t replace your accountant or your ERP. It sits alongside them,
            turning the numbers they collect into the daily decisions they don&apos;t surface.
          </p>
        </Section>

        {/* ── 8. PROOF ────────────────────────────────────────────────────── */}
        <Section id="proof" className="bg-white">
          <SectionTitle centered>What customers say.</SectionTitle>

          {/* PLACEHOLDER testimonials */}
          <div className="grid sm:grid-cols-3 gap-5 mt-8">
            {[
              {
                quote: "We freed $18,000 in dead stock in the first month. The reorder alerts have eliminated stockouts on our top 30 SKUs.",
                name: "M. Tan",
                title: "Owner",
                company: "Lin Imports — Asian groceries wholesaler, Sydney",
                initials: "MT",
              },
              {
                quote: "I used to spend Sunday night in Excel working out what to order Monday. Now it's waiting in my inbox. The margin breakdown alone was worth it.",
                name: "R. Okonkwo",
                title: "Director",
                company: "Meridian Distribution — Industrial parts, Melbourne",
                initials: "RO",
              },
              {
                quote: "The customer churn alerts caught three at-risk accounts in the first two weeks. We called, we saved two of them. That's real money.",
                name: "S. Patel",
                title: "General Manager",
                company: "Pacific Trade Co — Beauty & wellness, Auckland",
                initials: "SP",
              },
            ].map((t, i) => (
              // PLACEHOLDER: replace with real customer when available
              <div
                key={i}
                className="rounded-xl p-6 space-y-4 flex flex-col"
                style={{ background: "#F7F7F5", border: "1px solid #E5E5E2" }}
              >
                <p className="text-[15px] font-500 text-[#1A1A17] leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-600 shrink-0"
                    style={{ background: "#E5E5E2", color: "#5C5C57" }}
                    aria-label={`Avatar for ${t.name}`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-500 text-[#1A1A17]">{t.name}, {t.title}</p>
                    <p className="text-[12px]" style={{ color: "#9A9A93" }}>{t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust line + beta notice */}
          <div className="text-center mt-10">
            <p className="text-[15px] font-500 text-[#1A1A17]">
              Now in private beta.{" "}
              <Link href="/signup" className="underline underline-offset-2" style={{ color: "#4D7B3D" }}>
                Join 50+ businesses on the waitlist.
              </Link>
            </p>
          </div>

          {/* Logo placeholder row */}
          <div className="flex flex-wrap justify-center gap-4 mt-8" aria-label="Customer logos — placeholder">
            {Array.from({ length: 5 }).map((_, i) => (
              // PLACEHOLDER: real customer logos
              <div
                key={i}
                className="w-28 h-10 rounded-lg"
                style={{ background: "#E5E5E2" }}
                aria-hidden="true"
              />
            ))}
          </div>
        </Section>

        {/* ── 9. PRICING ──────────────────────────────────────────────────── */}
        <Section id="pricing">
          <SectionTitle centered>Pricing that respects your size.</SectionTitle>

          <div className="grid sm:grid-cols-3 gap-5 mt-10 items-start">
            <PricingCard
              name="Starter"
              price="$99"
              sub="Billed monthly"
              features={[
                "1 connected source (Shopify, Xero, or CSV)",
                "Up to 500 SKUs",
                "All 8 decision rules",
                "Daily email digest",
                "Email support",
              ]}
              cta="Start free trial"
              ctaHref="/signup"
            />
            <PricingCard
              name="Pro"
              price="$249"
              sub="Billed monthly"
              features={[
                "3 connected sources",
                "Up to 5,000 SKUs",
                "All 8 rules + elasticity & regression analytics",
                "Custom decision rules",
                "Multi-user (up to 5 seats)",
                "Priority email support",
              ]}
              cta="Start free trial"
              ctaHref="/signup"
              highlight
            />
            <PricingCard
              name="Business"
              price="$599"
              sub="Billed monthly"
              features={[
                "Unlimited sources",
                "Unlimited SKUs",
                "Custom integrations (SQL, API)",
                "Multi-warehouse support",
                "Multi-user (up to 20 seats)",
                "Phone + Slack support",
                "Onboarding session included",
              ]}
              cta="Talk to us"
              ctaHref="/contact"
            />
          </div>

          <p className="text-center text-[13px] mt-6" style={{ color: "#9A9A93" }}>
            All plans: 14-day free trial. No credit card. Cancel anytime. Annual billing saves 20%.
          </p>
          <p className="text-center text-[13px] mt-2" style={{ color: "#9A9A93" }}>
            Need something different? We work with businesses up to $50M revenue.{" "}
            <a
              href="mailto:tom@stockflow.io"
              className="underline underline-offset-2"
              style={{ color: "#5C5C57" }}
            >
              Email tom@stockflow.io
            </a>
          </p>
        </Section>

        {/* ── 10. FAQ ─────────────────────────────────────────────────────── */}
        <Section id="faq" className="bg-white">
          <SectionTitle centered>Questions we get a lot.</SectionTitle>
          <div className="max-w-2xl mx-auto mt-8">
            <MarketingFaq />
          </div>
        </Section>

        {/* ── 11. FINAL CTA ───────────────────────────────────────────────── */}
        <section className="py-24 px-5 text-center" style={{ background: "#F7F7F5" }}>
          <div className="max-w-2xl mx-auto space-y-5">
            <h2
              className="text-[36px] font-600 text-[#1A1A17] leading-tight"
            >
              Tomorrow morning, you could have your first decision list.
            </h2>
            <p className="text-[16px] leading-relaxed" style={{ color: "#5C5C57" }}>
              Connect a data source today. We&apos;ll have your real-margin breakdown, dead-stock
              alerts, and reorder recommendations ready by your first coffee tomorrow.
            </p>
            <div>
              <Link
                href="/signup"
                className="inline-block px-8 py-4 rounded-xl text-[16px] font-500 text-white transition-colors"
                style={{ background: "#1A1A17" }}
              >
                Start your 14-day free trial
              </Link>
            </div>
            <p className="text-[13px]" style={{ color: "#9A9A93" }}>
              No credit card. Cancel in 2 clicks. Real human support.
            </p>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ background: "#1A1A17", color: "#FFFFFF" }} role="contentinfo">
          <div className="max-w-6xl mx-auto px-5 py-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
              {/* Brand */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <rect width="22" height="22" rx="5" fill="#FFFFFF" fillOpacity="0.1" />
                    <path d="M5 15l4-6 3 3 3-4 2 2" stroke="#F7F7F5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="16" cy="7" r="1.5" fill="#4D7B3D" />
                  </svg>
                  <span className="text-[15px] font-600 text-white">Stockflow</span>
                </div>
                <p className="text-[13px]" style={{ color: "#9A9A93" }}>
                  Decision intelligence for product businesses.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href="https://twitter.com/stockflowio"
                    aria-label="Stockflow on X (Twitter)"
                    className="text-[13px] transition-opacity hover:opacity-70"
                    style={{ color: "#9A9A93" }}
                  >
                    𝕏
                  </a>
                  <a
                    href="https://linkedin.com/company/stockflowio"
                    aria-label="Stockflow on LinkedIn"
                    className="transition-opacity hover:opacity-70"
                    style={{ color: "#9A9A93" }}
                  >
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href="https://github.com/stockflowio"
                    aria-label="Stockflow on GitHub"
                    className="transition-opacity hover:opacity-70"
                    style={{ color: "#9A9A93" }}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* Product */}
              <FooterCol
                heading="Product"
                links={[
                  ["Today", "/today"],
                  ["Products", "/products"],
                  ["Insights", "/insights/inventory"],
                  ["Integrations", "/integrations"],
                  ["Pricing", "/pricing"],
                ]}
              />

              {/* Company */}
              <FooterCol
                heading="Company"
                links={[
                  ["About", "/about"],
                  ["Blog", "/blog"],
                  ["Careers", "/careers"],
                  ["Contact", "/contact"],
                ]}
              />

              {/* Resources */}
              <FooterCol
                heading="Resources"
                links={[
                  ["Help docs", "/docs"],
                  ["API", "/api-docs"],
                  ["Status", "/status"],
                  ["Changelog", "/changelog"],
                ]}
              />

              {/* Legal */}
              <FooterCol
                heading="Legal"
                links={[
                  ["Privacy", "/privacy"],
                  ["Terms", "/terms"],
                  ["Security", "/security"],
                  ["Data processing", "/dpa"],
                ]}
              />
            </div>

            <div
              className="mt-10 pt-6 flex items-center justify-center text-[12px]"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "#6B6B66" }}
            >
              © 2026 Stockflow. Made in Sydney.
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: [string, string][];
}) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] font-600 uppercase tracking-wider" style={{ color: "#6B6B66" }}>
        {heading}
      </p>
      <ul className="space-y-2" role="list">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-[13px] transition-colors hover:text-white"
              style={{ color: "#9A9A93" }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

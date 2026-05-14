import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Package, TrendingDown, UserMinus, TrendingUp } from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  stone: "#F5F3EE",
  cream: "#FEFDFB",
  ink: "#18170F",
  ink2: "#4D4B42",
  ink3: "#8A877D",
  ink4: "#B5B2A9",
  border: "#E0DDD5",
  accent: "#C7452B",
  accentLight: "#FDF0ED",
  green: "#3E7A2E",
  greenLight: "#ECF4E9",
  orange: "#B47214",
  orangeLight: "#FBF3E4",
} as const;

const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" };

// ── Hero product mockup ───────────────────────────────────────────────────────
function HeroMockup() {
  type MockRow = {
    title: string;
    sub: React.ReactNode;
    btnColor: string;
    btnText: string;
    borderColor: string;
  };
  const urgent: MockRow[] = [
    {
      title: "Reorder Sesame Oil 500ml",
      sub: (
        <>
          <strong style={{ color: C.ink }}>240 units</strong> from Lin Imports · stock runs out in{" "}
          <strong style={{ color: C.ink }}>3 days</strong>
        </>
      ),
      btnColor: C.accent,
      btnText: "Order $2,880",
      borderColor: C.accent,
    },
    {
      title: "Reorder Black Vinegar 750ml",
      sub: (
        <>
          <strong style={{ color: C.ink }}>60 units</strong> from García Co · runs out in{" "}
          <strong style={{ color: C.ink }}>2 days</strong>
        </>
      ),
      btnColor: C.accent,
      btnText: "Order $720",
      borderColor: C.accent,
    },
  ];
  const thisWeek: MockRow[] = [
    {
      title: "Liquidate 3 dead-stock SKUs",
      sub: (
        <>
          Idle 6+ months · frees <strong style={{ color: C.ink }}>$4,200</strong> cash
        </>
      ),
      btnColor: C.orange,
      btnText: "−50%",
      borderColor: C.orange,
    },
    {
      title: "Call Wong Foods",
      sub: (
        <>
          45 days quiet · normally every 20 · <strong style={{ color: C.ink }}>$34k/yr</strong> at risk
        </>
      ),
      btnColor: C.orange,
      btnText: "Mark called",
      borderColor: C.orange,
    },
  ];

  return (
    <div
      style={{
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow:
          "0 2px 4px rgba(0,0,0,0.02), 0 24px 48px rgba(24,23,15,0.08)",
        animation: "floatY 6s ease infinite",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2.5"
        style={{
          background: C.stone,
          borderBottom: `1px solid ${C.border}`,
          padding: "10px 16px",
        }}
      >
        <div className="flex gap-[5px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.ink4,
                opacity: 0.5,
                display: "block",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontSize: 11,
            color: C.ink3,
            letterSpacing: "0.03em",
            fontWeight: 500,
          }}
        >
          arachnet.io / today
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "20px", background: "white" }}>
        <div
          style={{ ...serif, fontSize: 20, marginBottom: 6, color: C.ink }}
        >
          Good morning, María.
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.ink3,
            marginBottom: 18,
            fontWeight: 500,
          }}
        >
          Monday 28 Apr · 7 actions · 2 urgent
        </div>

        {/* Urgent */}
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.ink2,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
            marginTop: 14,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.accent,
              display: "block",
            }}
          />
          Urgent — act today
        </div>
        {urgent.map((card, i) => (
          <div
            key={i}
            className="flex items-center justify-between mb-1.5"
            style={{
              background: "white",
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${card.borderColor}`,
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.ink,
                  marginBottom: 2,
                  letterSpacing: "-0.01em",
                }}
              >
                {card.title}
              </div>
              <div
                style={{ fontSize: 11.5, color: C.ink3, fontWeight: 500 }}
              >
                {card.sub}
              </div>
            </div>
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                color: "white",
                background: card.btnColor,
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              {card.btnText}
            </span>
          </div>
        ))}

        {/* This week */}
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.ink2,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
            marginTop: 14,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.orange,
              display: "block",
            }}
          />
          This week
        </div>
        {thisWeek.map((card, i) => (
          <div
            key={i}
            className="flex items-center justify-between mb-1.5"
            style={{
              background: "white",
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${card.borderColor}`,
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.ink,
                  marginBottom: 2,
                  letterSpacing: "-0.01em",
                }}
              >
                {card.title}
              </div>
              <div
                style={{ fontSize: 11.5, color: C.ink3, fontWeight: 500 }}
              >
                {card.sub}
              </div>
            </div>
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                color: "white",
                background: card.btnColor,
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              {card.btnText}
            </span>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div
        style={{
          textAlign: "center",
          padding: 10,
          fontSize: 11,
          color: C.ink4,
          fontWeight: 500,
          borderTop: `1px solid ${C.border}`,
          background: C.stone,
        }}
      >
        Updated 7:00 AM AEST · models ran on 1,247 active SKUs
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) redirect("/today");

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded"
        style={{ background: C.ink, color: "white" }}
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          className="grid md:grid-cols-[1fr_1.1fr] gap-10 md:gap-16 items-start md:items-center pt-[120px] md:pt-[140px] pb-20 px-8 max-w-[1200px] mx-auto md:min-h-[90vh]"
          aria-label="Hero"
        >
          {/* Left copy */}
          <div style={{ animation: "fadeUp 0.7s ease forwards" }}>
            {/* Tag */}
            <div
              className="inline-flex items-center gap-2 mb-7"
              style={{
                padding: "5px 14px 5px 8px",
                background: C.stone,
                border: `1px solid ${C.border}`,
                borderRadius: 100,
                fontSize: 12.5,
                fontWeight: 600,
                color: C.ink2,
                letterSpacing: "0.01em",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: C.green,
                  flexShrink: 0,
                  animation: "pulseDot 2s ease infinite",
                }}
              />
              Now in beta · wholesale &amp; distribution
            </div>

            {/* Headline */}
            <h1
              style={{
                ...serif,
                fontSize: "clamp(38px, 5vw, 54px)",
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
                marginBottom: 24,
                color: C.ink,
              }}
            >
              Know what to buy.
              <br />
              Know what to cut.
              <br />
              <em style={{ fontStyle: "italic", color: C.ink3 }}>
                Before it costs you.
              </em>
            </h1>

            {/* Subheadline */}
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: C.ink2,
                maxWidth: 480,
                marginBottom: 36,
              }}
            >
              Every morning, one email tells you what to reorder, what&apos;s
              bleeding cash, which customers are slipping, and what price changes
              to make. Built on your data, explained in plain English.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 items-center mb-7">
              <Link
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 28px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  background: C.accent,
                  color: "white",
                  letterSpacing: "-0.01em",
                  transition: "all 0.15s ease",
                }}
              >
                Start for $1 / month
              </Link>
              <a
                href="#how"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 28px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  background: "transparent",
                  color: C.ink,
                  border: `1px solid ${C.border}`,
                  letterSpacing: "-0.01em",
                  transition: "all 0.15s ease",
                }}
              >
                See how it works ↓
              </a>
            </div>

            {/* Trust line */}
            <div
              className="flex flex-wrap items-center gap-2"
              style={{ fontSize: 13, color: C.ink3 }}
            >
              <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>✓</span>{" "}
              No credit card
              <span style={{ color: C.ink4 }}>·</span>
              <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>✓</span>{" "}
              Connect Shopify or upload CSV
              <span style={{ color: C.ink4 }}>·</span>
              <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>✓</span>{" "}
              First decisions by tomorrow
            </div>
          </div>

          {/* Right — mockup */}
          <div
            className="relative mt-8 md:mt-0"
            style={{ opacity: 0, animation: "slideLeft 0.8s ease 0.2s forwards" }}
            aria-hidden="true"
          >
            <HeroMockup />

            {/* Floating badge */}
            <div
              className="absolute flex items-center gap-2.5"
              style={{
                bottom: -20,
                left: 30,
                background: "white",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                fontSize: 12.5,
                fontWeight: 600,
                color: C.ink,
                opacity: 0,
                animation: "fadeUp 0.8s ease 0.6s forwards",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: C.greenLight,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.green,
                }}
              >
                <TrendingUp size={14} />
              </div>
              $22.4k cash freed this month
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF BAR ─────────────────────────────────────────── */}
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
            padding: "24px 32px",
            background: C.stone,
          }}
        >
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-8 md:gap-10">
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.ink3,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              Used by
            </span>
            <div className="flex flex-wrap gap-6 md:gap-8 items-center">
              {[
                "Lin Imports",
                "Pacific Trade",
                "Meridian Dist.",
                "Evergreen Wholesale",
                "NovaPack",
              ].map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: C.ink4,
                    letterSpacing: "-0.01em",
                    opacity: 0.7,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
            <div
              className="hidden sm:block"
              style={{
                width: 1,
                height: 24,
                background: C.border,
                flexShrink: 0,
              }}
            />
            <span
              className="hidden sm:block"
              style={{ fontSize: 13, color: C.ink2, whiteSpace: "nowrap" }}
            >
              <strong style={{ color: C.ink, fontWeight: 700 }}>50+</strong>{" "}
              businesses on waitlist
            </span>
          </div>
        </div>

        {/* ── PROBLEMS ─────────────────────────────────────────────────── */}
        <section
          id="problems"
          style={{
            padding: "100px 32px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.accent,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 12,
            }}
          >
            The real cost
          </div>
          <h2
            style={{
              ...serif,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Three problems that quietly eat your profit.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: C.ink2,
              maxWidth: 560,
              marginBottom: 56,
              lineHeight: 1.6,
            }}
          >
            Not because you&apos;re not working hard. Because the data that
            matters is buried in spreadsheets that nobody updates fast enough.
          </p>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                topColor: C.accent,
                iconBg: C.accentLight,
                icon: <Package size={20} color={C.accent} />,
                n: "1",
                headline: "Cash trapped in stock nobody's buying.",
                text: "$30k of dead inventory sitting in the warehouse. You know it's there. You can't quantify it. Every reorder feels like a guess because the spreadsheet is always a week behind.",
                textExtra: null,
              },
              {
                topColor: C.orange,
                iconBg: C.orangeLight,
                icon: <TrendingDown size={20} color={C.orange} />,
                n: "2",
                headline: "Best-sellers that don't actually make money.",
                text: "Your top product by revenue runs at 6% margin after freight. You find out when accounting closes the quarter. By then you've ordered three more pallets",
                textExtra: (
                  <>
                    {" "}
                    <em style={{ fontStyle: "italic", color: C.ink3 }}>and</em>{" "}
                    given a volume discount.
                  </>
                ),
              },
              {
                topColor: C.ink3,
                iconBg: C.stone,
                icon: <UserMinus size={20} color={C.ink3} />,
                n: "3",
                headline: "Customers leaving before you notice.",
                text: "Your $40k/year client hasn't ordered in 50 days. Their normal interval was every 20. If someone had flagged it on day 25, you'd have called. Now they're buying from someone else.",
                textExtra: null,
              },
            ].map((card, i) => (
              <div
                key={i}
                className="relative overflow-hidden transition-all duration-200 hover:-translate-y-[3px]"
                style={{
                  background: "white",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "32px 28px",
                }}
              >
                {/* Top color bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: card.topColor,
                  }}
                />
                {/* Background number */}
                <span
                  style={{
                    ...serif,
                    fontStyle: "italic",
                    fontSize: 48,
                    color: C.ink4,
                    opacity: 0.3,
                    position: "absolute",
                    top: 20,
                    right: 24,
                    lineHeight: 1,
                    pointerEvents: "none",
                  }}
                >
                  {card.n}
                </span>
                {/* Icon */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: card.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    ...serif,
                    fontSize: 22,
                    marginBottom: 12,
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                    color: C.ink,
                  }}
                >
                  {card.headline}
                </h3>
                <p style={{ fontSize: 14.5, color: C.ink2, lineHeight: 1.6 }}>
                  {card.text}
                  {card.textExtra}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── OUTCOME ──────────────────────────────────────────────────── */}
        <section
          style={{
            padding: "100px 32px",
            background: C.ink,
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Radial accent gradient */}
          <div
            style={{
              position: "absolute",
              top: -200,
              right: -200,
              width: 600,
              height: 600,
              background:
                "radial-gradient(circle, rgba(199,69,43,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 12,
                }}
              >
                The daily output
              </div>
              <h2
                style={{
                  ...serif,
                  fontSize: "clamp(28px, 4vw, 40px)",
                  lineHeight: 1.12,
                  letterSpacing: "-0.02em",
                  marginBottom: 20,
                }}
              >
                One email. Every morning.{" "}
                <em style={{ fontStyle: "italic", color: C.ink4 }}>
                  Six decisions, ranked.
                </em>
              </h2>
              <p
                style={{
                  fontSize: 17,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.6,
                  marginBottom: 36,
                  maxWidth: 460,
                }}
              >
                At 7am, before your first coffee, you&apos;ll have a list of the
                five most important things your business needs today — with the
                math behind each one.
              </p>

              <ul style={{ listStyle: "none" }}>
                {[
                  "Reorder 240 units of Sesame Oil — combine with Soy Sauce order to save $120 in shipping",
                  "Drop 3 dead SKUs to 50% off — frees $4,200 of trapped cash in one click",
                  "Call Wong Foods — they've gone quiet. $34k annual revenue at risk",
                  "Sesame Oil 5L margin is 6%. Suggested new price: $14.20 (→ 22% margin)",
                ].map((item, i, arr) => (
                  <li
                    key={i}
                    className="flex items-start gap-3.5"
                    style={{
                      padding: "14px 0",
                      borderBottom:
                        i < arr.length - 1
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "none",
                      fontSize: 15,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        background: "rgba(62,122,46,0.2)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6EBB59",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — email mockup */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                className="flex justify-between items-center"
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.35)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  ArachNet Daily
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  Mon 28 Apr · 7:00 AM
                </span>
              </div>

              <div
                style={{
                  ...serif,
                  fontSize: 18,
                  padding: "16px 20px 8px",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                Your 7 actions for Monday
              </div>

              <div
                style={{
                  padding: "8px 20px 20px",
                  fontSize: 13.5,
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.6,
                }}
              >
                Good morning, María. Two reorders are urgent — both risk
                stockout this week. The Lin Imports order combines two SKUs and
                saves ~$120 in shipping.
              </div>

              <div
                style={{
                  padding: "0 20px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {[
                  {
                    text: "Order Sesame Oil · 240 uds · $2,880",
                    btn: "Create order →",
                    bg: C.accent,
                  },
                  {
                    text: "Liquidate 3 dead SKUs · free $4,200",
                    btn: "Apply −50% →",
                    bg: C.orange,
                  },
                  {
                    text: "Call Wong Foods · 45 days quiet",
                    btn: "Mark called →",
                    bg: C.ink3,
                  },
                ].map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between"
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 500,
                    }}
                  >
                    <span>{a.text}</span>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "white",
                        background: a.bg,
                        flexShrink: 0,
                        marginLeft: 10,
                      }}
                    >
                      {a.btn}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.2)",
                  textAlign: "center",
                }}
              >
                Models ran on 1,247 SKUs · 412 high confidence · 198 medium · 88
                flagged for review
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section
          id="how"
          style={{
            padding: "100px 32px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.accent,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 12,
            }}
          >
            Getting started
          </div>
          <h2
            style={{
              ...serif,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 56,
            }}
          >
            From messy data to clear decisions in under 24 hours.
          </h2>

          <div
            className="grid md:grid-cols-3"
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              background: "white",
            }}
          >
            {[
              {
                n: "1",
                title: "Connect",
                text: "Plug into Shopify, Xero, or upload a CSV. We auto-map your columns even if they're in Spanish, Mandarin, or your accountant's freestyle.",
                time: "5 minutes. No IT required.",
              },
              {
                n: "2",
                title: "Calibrate",
                text: "Tell us about your business — perishable or not, payment terms, seasons that matter. Set your thresholds. Change them anytime, from anywhere in the product.",
                time: "10 minutes. Sensible defaults.",
              },
              {
                n: "3",
                title: "Decide",
                text: "Tomorrow morning, your first list of actions arrives. Reorders, discounts, follow-ups, margin warnings — ranked by urgency, explained, actionable in one click.",
                time: "Daily. Automatically. Forever.",
              },
            ].map((step, i, arr) => (
              <div
                key={i}
                className={
                  i < arr.length - 1
                    ? "border-b border-[#E0DDD5] md:border-b-0 md:border-r"
                    : ""
                }
                style={{ padding: "40px 32px", position: "relative" }}
              >
                <div
                  style={{
                    ...serif,
                    fontStyle: "italic",
                    fontSize: 64,
                    color: C.ink4,
                    opacity: 0.15,
                    lineHeight: 1,
                    marginBottom: 16,
                  }}
                >
                  {step.n}
                </div>
                <h3
                  style={{
                    ...serif,
                    fontSize: 22,
                    marginBottom: 12,
                    letterSpacing: "-0.01em",
                    color: C.ink,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 14.5,
                    color: C.ink2,
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {step.text}
                </p>
                <span
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 12, fontWeight: 600, color: C.green }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: C.green,
                      display: "inline-block",
                    }}
                  />
                  {step.time}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
        <section
          style={{
            padding: "100px 32px",
            background: C.stone,
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.accent,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 12,
              }}
            >
              What customers say
            </div>
            <h2
              style={{
                ...serif,
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                marginBottom: 48,
              }}
            >
              Plain results from real operators.
            </h2>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  quote:
                    "ArachNet told us one of our top products was high revenue but low margin. We stopped reordering blindly and changed the pricing. First month we recovered $8k in margin we were giving away.",
                  name: "M. Tan",
                  role: "Owner",
                  company: "Lin Imports — groceries wholesaler, Sydney",
                },
                {
                  quote:
                    "I used to spend Sunday night in Excel working out what to order Monday. Now it's waiting in my inbox. The margin breakdown alone was worth the subscription.",
                  name: "R. Okonkwo",
                  role: "Director",
                  company:
                    "Meridian Distribution — industrial parts, Melbourne",
                },
                {
                  quote:
                    "The customer follow-up alerts caught three at-risk accounts in the first two weeks. We called them. We saved two. That's not a feature — that's money.",
                  name: "S. Patel",
                  role: "General Manager",
                  company: "Pacific Trade Co — beauty & wellness, Auckland",
                },
              ].map((t, i) => (
                // PLACEHOLDER: replace with real customer quotes when available
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${C.border}`,
                    paddingLeft: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 15,
                      color: C.ink,
                      lineHeight: 1.65,
                      marginBottom: 16,
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p style={{ fontSize: 13, color: C.ink3 }}>
                    — {t.name}, {t.role} · {t.company}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BAND ─────────────────────────────────────────────────── */}
        <section
          id="pricing"
          style={{
            padding: "80px 32px",
            textAlign: "center",
            background: C.stone,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <h2
            style={{
              ...serif,
              fontSize: "clamp(28px, 4vw, 38px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginBottom: 18,
              maxWidth: 600,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Tomorrow morning, you could have your first decision list.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: C.ink2,
              marginBottom: 32,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            Connect your data today. Reorder risks, margin alerts, customer
            follow-ups, and cash flow insights — ready by your first coffee.
          </p>
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 28px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              background: C.ink,
              color: "white",
              letterSpacing: "-0.01em",
            }}
          >
            Start for $1 / month
          </Link>
          <p style={{ fontSize: 13, color: C.ink3, marginTop: 18 }}>
            $1 first month · Cancel in 2 clicks · Plans from $149/mo
          </p>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer
          style={{
            background: C.ink,
            color: "rgba(255,255,255,0.5)",
            padding: "56px 32px 32px",
          }}
          role="contentinfo"
        >
          <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 md:gap-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div
                  style={{
                    width: 24,
                    height: 24,
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontFamily: "var(--font-serif)",
                    fontSize: 14,
                  }}
                >
                  S
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 17,
                    color: "white",
                  }}
                >
                  ArachNet
                </span>
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  maxWidth: 260,
                  marginBottom: 20,
                }}
              >
                Decision intelligence for product businesses. Know what to buy.
                Know what to cut. Before it costs you.
              </p>
            </div>

            {/* Product */}
            <FooterCol
              heading="Product"
              links={[
                ["How it works", "#how"],
                ["Pricing", "#pricing"],
                ["Integrations", "/integrations"],
                ["Security", "/security"],
              ]}
            />

            {/* Company */}
            <FooterCol
              heading="Company"
              links={[
                ["About", "/about"],
                ["Blog", "/blog"],
                ["Contact", "/contact"],
                ["Careers", "/careers"],
              ]}
            />

            {/* Resources */}
            <FooterCol
              heading="Resources"
              links={[
                ["Help docs", "/docs"],
                ["The math", "/math"],
                ["Changelog", "/changelog"],
                ["Status", "/status"],
              ]}
            />
          </div>

          {/* Bottom bar */}
          <div
            className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4"
            style={{
              paddingTop: 28,
              marginTop: 40,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.3)" }}>
              © 2026 ArachNet. Made in Sydney.
            </span>
            <div className="flex gap-4">
              {[
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    transition: "color 0.15s ease",
                  }}
                >
                  {label}
                </Link>
              ))}
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
    <div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 16,
        }}
      >
        {heading}
      </div>
      {links.map(([label, href]) => (
        <Link
          key={label}
          href={href}
          style={{
            display: "block",
            fontSize: 13.5,
            color: "rgba(255,255,255,0.5)",
            padding: "4px 0",
            transition: "color 0.15s ease",
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

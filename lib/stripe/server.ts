import Stripe from "stripe";

// Server-only — never import this in client components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// ── Price ID helpers ──────────────────────────────────────────────────────────

type PlanKey = "starter" | "pro" | "business";

/** Maps planKey → $1/month trial price ID for use in Checkout sessions */
export function trialPriceId(planKey: PlanKey): string {
  const map: Record<PlanKey, string> = {
    starter: process.env.STRIPE_PRICE_STARTER_TRIAL!,
    pro: process.env.STRIPE_PRICE_PRO_TRIAL!,
    business: process.env.STRIPE_PRICE_BUSINESS_TRIAL!,
  };
  return map[planKey];
}

/** Given any price ID (trial or full), returns the plan name */
export function planFromPriceId(priceId: string): PlanKey {
  const map: Record<string, PlanKey> = {
    [process.env.STRIPE_PRICE_STARTER_TRIAL!]: "starter",
    [process.env.STRIPE_PRICE_STARTER!]: "starter",
    [process.env.STRIPE_PRICE_PRO_TRIAL!]: "pro",
    [process.env.STRIPE_PRICE_PRO!]: "pro",
    [process.env.STRIPE_PRICE_BUSINESS_TRIAL!]: "business",
    [process.env.STRIPE_PRICE_BUSINESS!]: "business",
  };
  return map[priceId] ?? "starter";
}

/** Given a trial price ID, returns the corresponding full-price ID (for schedule upgrade) */
export function fullPriceForTrialPrice(trialPrice: string): string | null {
  const map: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER_TRIAL!]: process.env.STRIPE_PRICE_STARTER!,
    [process.env.STRIPE_PRICE_PRO_TRIAL!]: process.env.STRIPE_PRICE_PRO!,
    [process.env.STRIPE_PRICE_BUSINESS_TRIAL!]: process.env.STRIPE_PRICE_BUSINESS!,
  };
  return map[trialPrice] ?? null;
}

/** Display metadata for each plan */
export const PLAN_META: Record<PlanKey, { label: string; fullMonthlyUsd: number }> = {
  starter: { label: "Starter", fullMonthlyUsd: 99 },
  pro: { label: "Pro", fullMonthlyUsd: 249 },
  business: { label: "Business", fullMonthlyUsd: 599 },
};

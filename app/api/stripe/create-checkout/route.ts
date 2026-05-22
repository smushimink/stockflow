import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, trialPriceId } from "@/lib/stripe/server";

const schema = z.object({
  planKey: z.enum(["starter", "pro", "business"]),
});

// Simple in-memory rate limiter: max 10 requests per IP per 60s window
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export async function POST(request: Request) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const { planKey } = parsed.data;

  const admin = createAdminClient();

  // Get org
  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    // No org yet — send to onboarding
    return NextResponse.json({ redirect: "/onboarding" });
  }

  const orgId = membership.organization_id;

  const { data: org } = await admin
    .from("organizations")
    .select("name, stripe_customer_id, subscription_status")
    .eq("id", orgId)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  // Already subscribed — go to billing settings
  if (org.subscription_status === "active" || org.subscription_status === "trialing") {
    return NextResponse.json({ redirect: "/settings/billing" });
  }

  // Get or create Stripe customer
  let customerId = org.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { organization_id: orgId },
    });
    customerId = customer.id;

    await admin
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", orgId);
  }

  // Create Checkout session
  const priceId = trialPriceId(planKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}&plan=${planKey}`,
    cancel_url: `${appUrl}/pricing`,
    metadata: {
      organization_id: orgId,
      plan: planKey,
    },
  });

  return NextResponse.json({ url: session.url });
}

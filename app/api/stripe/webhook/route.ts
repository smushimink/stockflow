import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe, planFromPriceId, fullPriceForTrialPrice } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendWelcomeEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
} from "@/lib/email/send";

// Stripe sends the raw body — do not let Next.js parse it
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      // ── Checkout completed ───────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const orgId = session.metadata?.organization_id;
        const planKey = session.metadata?.plan ?? "starter";
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;

        if (!orgId || !subscriptionId) break;

        // Retrieve subscription to set up the upgrade schedule
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const subItem = subscription.items.data[0];
        const priceId = subItem?.price?.id;
        const fullPrice = priceId ? fullPriceForTrialPrice(priceId) : null;
        // current_period_end lives on SubscriptionItem in Stripe v22+
        const periodEnd = subItem?.current_period_end ?? 0;

        // Create subscription schedule: month 1 at $1 → month 2+ at full price.
        // Must create first (from_subscription), then update with phases — Stripe
        // doesn't allow setting phases inline when using from_subscription.
        if (priceId && fullPrice && periodEnd) {
          try {
            const schedule = await stripe.subscriptionSchedules.create({
              from_subscription: subscriptionId,
            });
            await stripe.subscriptionSchedules.update(schedule.id, {
              end_behavior: "release",
              phases: [
                {
                  items: [{ price: priceId, quantity: 1 }],
                  end_date: periodEnd,
                },
                {
                  items: [{ price: fullPrice, quantity: 1 }],
                },
              ],
            });
          } catch (err) {
            // Non-fatal — subscription still works, just won't auto-upgrade
            console.error("Failed to create subscription schedule:", err);
          }
        }

        // Update org
        await admin
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            plan: planKey,
            subscription_current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .eq("id", orgId);

        // Welcome email — get owner email
        const { data: membership } = await admin
          .from("memberships")
          .select("user_id")
          .eq("organization_id", orgId)
          .limit(1)
          .single();

        if (membership) {
          const { data: authUser } = await admin.auth.admin.getUserById(membership.user_id);
          if (authUser?.user?.email) {
            await sendWelcomeEmail(authUser.user.email, planKey).catch(console.error);
          }
        }

        break;
      }

      // ── Subscription updated (plan change, renewal, schedule phase switch) ─
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (!org) break;

        const subItem = subscription.items.data[0];
        const priceId = subItem?.price?.id;
        const plan = priceId ? planFromPriceId(priceId) : "starter";
        const periodEnd = subItem?.current_period_end ?? 0;

        await admin
          .from("organizations")
          .update({
            subscription_status: subscription.status,
            plan,
            subscription_current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .eq("id", org.id);

        break;
      }

      // ── Subscription cancelled ───────────────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (!org) break;

        await admin
          .from("organizations")
          .update({
            subscription_status: "cancelled",
            plan: "free",
            stripe_subscription_id: null,
          })
          .eq("id", org.id);

        // Cancellation email
        const customerId = subscription.customer as string;
        const { data: orgForEmail } = await admin
          .from("organizations")
          .select("stripe_customer_id")
          .eq("id", org.id)
          .single();

        if (orgForEmail) {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted && customer.email) {
            await sendCancellationEmail(customer.email).catch(console.error);
          }
        }

        break;
      }

      // ── Payment failed ───────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: org } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!org) break;

        await admin
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("id", org.id);

        // Payment failed email
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.email) {
          await sendPaymentFailedEmail(customer.email).catch(console.error);
        }

        break;
      }
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

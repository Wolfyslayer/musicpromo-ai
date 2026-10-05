import { serviceClient } from "../_shared/runtime.ts";
import { verifyStripeWebhookSignature } from "../_shared/stripeWebhookVerify.ts";
import {
  monthlyCreditsForPlan,
  planFromStripePriceId,
  type BillingInterval,
  type PaidPlanId,
} from "../_shared/subscriptionPlans.ts";

function intervalFromStripe(subscription: Record<string, unknown>): BillingInterval {
  const items = subscription.items as { data?: Array<{ price?: { recurring?: { interval?: string } } }> } | undefined;
  const interval = items?.data?.[0]?.price?.recurring?.interval;
  return interval === "year" ? "year" : "month";
}

function priceIdFromSubscription(subscription: Record<string, unknown>): string {
  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  return String(items?.data?.[0]?.price?.id || "");
}

async function applyPaidSubscription(userId: string, subscription: Record<string, unknown>) {
  const admin = serviceClient();
  const status = String(subscription.status || "");
  const periodEnd = subscription.current_period_end
    ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
    : null;
  const subId = String(subscription.id || "");
  const priceId = priceIdFromSubscription(subscription);

  const active = status === "active" || status === "trialing";
  const paidPlan: PaidPlanId | null = active ? planFromStripePriceId(priceId) : null;
  const plan = active && paidPlan ? paidPlan : "free";
  const grant = active && paidPlan ? monthlyCreditsForPlan(paidPlan) : 0;
  const billingInterval = intervalFromStripe(subscription);

  const { data: existing } = await admin.from("user_billing").select("credits_balance").eq("user_id", userId).maybeSingle();
  const balance = active && grant ? Math.max(Number(existing?.credits_balance || 0), grant) : Number(existing?.credits_balance || 0);

  await admin.from("user_billing").upsert(
    {
      user_id: userId,
      plan,
      stripe_subscription_id: subId,
      stripe_price_id: priceId || null,
      billing_interval: billingInterval,
      subscription_status: status,
      subscription_current_period_end: periodEnd,
      credits_balance: balance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (active && paidPlan) {
    await admin.from("credit_ledger").insert({
      user_id: userId,
      delta: 0,
      balance_after: balance,
      action: "subscription_activated",
      metadata: { subscriptionId: subId, status, plan: paidPlan, grantApplied: grant, priceId },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!(Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim()) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";
  if (!sigHeader) {
    return new Response("Missing signature", { status: 400 });
  }

  const webhookSecret = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
  const valid = await verifyStripeWebhookSignature(payload, sigHeader, webhookSecret);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  async function resolveUserId(obj: Record<string, unknown>): Promise<string> {
    const meta = (obj.metadata as Record<string, string>) || {};
    const fromMeta = String(meta.user_id || "").trim();
    if (fromMeta) return fromMeta;
    const customerId = String(obj.customer || "").trim();
    if (!customerId) return "";
    const admin = serviceClient();
    const { data } = await admin
      .from("user_billing")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.user_id ? String(data.user_id) : "";
  }

  try {
    const type = event.type || "";
    const obj = event.data?.object || {};

    if (type === "checkout.session.completed") {
      const userId = String((obj.metadata as Record<string, string>)?.user_id || "");
      const subId = String(obj.subscription || "");
      if (userId && subId) {
        const secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        const sub = await subRes.json();
        if (subRes.ok) await applyPaidSubscription(userId, sub);
      }
    }

    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const userId = await resolveUserId(obj);
      if (userId) await applyPaidSubscription(userId, obj);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stripeBillingWebhook]", e);
    return new Response("Webhook handler failed", { status: 500 });
  }
});

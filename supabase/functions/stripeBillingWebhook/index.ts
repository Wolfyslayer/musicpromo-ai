import { serviceClient } from "../_shared/runtime.ts";
import { verifyStripeWebhookSignature } from "../_shared/stripeWebhookVerify.ts";

function proGrant(): number {
  const raw = Deno.env.get("BILLING_PRO_MONTHLY_CREDITS");
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 1200;
}

async function applyProSubscription(userId: string, subscription: Record<string, unknown>) {
  const admin = serviceClient();
  const status = String(subscription.status || "");
  const periodEnd = subscription.current_period_end
    ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
    : null;
  const subId = String(subscription.id || "");

  const active = status === "active" || status === "trialing";
  const grant = active ? proGrant() : 0;

  const { data: existing } = await admin.from("user_billing").select("credits_balance").eq("user_id", userId).maybeSingle();
  const balance = active ? Math.max(Number(existing?.credits_balance || 0), grant) : Number(existing?.credits_balance || 0);

  await admin.from("user_billing").upsert(
    {
      user_id: userId,
      plan: active ? "pro" : "free",
      stripe_subscription_id: subId,
      subscription_status: status,
      subscription_current_period_end: periodEnd,
      credits_balance: balance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (active) {
    await admin.from("credit_ledger").insert({
      user_id: userId,
      delta: 0,
      balance_after: balance,
      action: "subscription_activated",
      metadata: { subscriptionId: subId, status, grantApplied: grant },
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
        if (subRes.ok) await applyProSubscription(userId, sub);
      }
    }

    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const userId = await resolveUserId(obj);
      if (userId) await applyProSubscription(userId, obj);
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

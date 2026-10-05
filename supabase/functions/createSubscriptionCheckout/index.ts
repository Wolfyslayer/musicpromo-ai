import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { ensureUserBilling } from "../_shared/billing.ts";
import { isBillingExempt, resolveAppRole } from "../_shared/appRoles.ts";
import { normalizeCreditPackId, resolveCreditPackPriceId } from "../_shared/creditPacks.ts";
import {
  normalizeBillingInterval,
  normalizePaidPlanId,
  resolveStripePriceId,
} from "../_shared/subscriptionPlans.ts";
import { ensureStripeCustomer, stripeRequest } from "../_shared/stripeCustomer.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const checkoutType = String(body?.checkoutType || body?.type || "subscription").toLowerCase();

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const appOrigin = (Deno.env.get("PUBLIC_APP_URL") || "https://musicpromoai.site").replace(/\/$/, "");
    const admin = serviceClient();
    const uid = String(user.id);

    if (await isBillingExempt(admin, uid)) {
      const appRole = await resolveAppRole(admin, uid);
      return jsonWithCors(req, {
        ok: true,
        billingExempt: true,
        appRole,
        message: "Your account bypasses credit limits; Stripe checkout is not required.",
      });
    }

    await ensureUserBilling(admin, uid);
    const customerId = await ensureStripeCustomer(admin, uid, String(user.email || ""));

    if (checkoutType === "credit_pack" || body?.packId || body?.creditPack) {
      const packId = normalizeCreditPackId(body?.packId || body?.creditPack);
      if (!packId) {
        return jsonWithCors(req, { error: "packId must be boost_100, boost_300, boost_800, or boost_2000" }, 400);
      }
      const priceId = resolveCreditPackPriceId(packId);
      if (!priceId) {
        return jsonWithCors(
          req,
          { error: `Stripe price not configured for pack ${packId}. Set STRIPE_CREDIT_PACK_${packId.toUpperCase()}_PRICE_ID.` },
          503
        );
      }

      const session = await stripeRequest(
        "/checkout/sessions",
        new URLSearchParams({
          mode: "payment",
          customer: customerId,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: `${appOrigin}/settings/billing?checkout=success&purchase=credits&pack=${packId}`,
          cancel_url: `${appOrigin}/settings/billing?checkout=cancel`,
          "metadata[user_id]": uid,
          "metadata[checkout_type]": "credit_pack",
          "metadata[credit_pack_id]": packId,
        })
      );

      return jsonWithCors(req, { ok: true, url: session.url, sessionId: session.id, packId, checkoutType: "credit_pack" });
    }

    const planId = normalizePaidPlanId(body?.plan || body?.tier || "creator");
    const interval = normalizeBillingInterval(body?.interval || body?.billingInterval);

    if (!planId) {
      return jsonWithCors(req, { error: "plan must be creator, pro, or studio" }, 400);
    }

    const priceId = resolveStripePriceId(planId, interval);
    if (!priceId) {
      return jsonWithCors(
        req,
        {
          error: `Stripe price not configured for ${planId} (${interval}). Set STRIPE_${planId.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRICE_ID.`,
        },
        503
      );
    }

    const session = await stripeRequest(
      "/checkout/sessions",
      new URLSearchParams({
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appOrigin}/settings/billing?checkout=success&plan=${planId}&interval=${interval}`,
        cancel_url: `${appOrigin}/settings/billing?checkout=cancel`,
        "metadata[user_id]": uid,
        "metadata[checkout_type]": "subscription",
        "metadata[plan]": planId,
        "metadata[interval]": interval,
        "subscription_data[metadata][user_id]": uid,
        "subscription_data[metadata][plan]": planId,
      })
    );

    return jsonWithCors(req, { ok: true, url: session.url, sessionId: session.id, plan: planId, interval });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

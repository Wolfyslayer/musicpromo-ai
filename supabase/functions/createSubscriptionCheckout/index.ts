import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { ensureUserBilling } from "../_shared/billing.ts";
import { isBillingExempt, resolveAppRole } from "../_shared/appRoles.ts";
import { normalizeCreditPackId, resolveCreditPackPriceId } from "../_shared/creditPacks.ts";
import {
  normalizeBillingInterval,
  normalizePaidPlanId,
  resolveStripePriceId,
} from "../_shared/subscriptionPlans.ts";
import {
  assertCheckoutPriceId,
  ensureStripeCustomer,
  stripePublishableKey,
  stripeRequest,
} from "../_shared/stripeCustomer.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

function embeddedReturnUrl(appOrigin: string, query: Record<string, string>): string {
  const params = new URLSearchParams({ checkout: "complete", ...query });
  return `${appOrigin}/settings/billing?${params.toString()}&session_id={CHECKOUT_SESSION_ID}`;
}

function embeddedSessionFields(appOrigin: string, returnQuery: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    ui_mode: "embedded",
    redirect_on_completion: "if_required",
    return_url: embeddedReturnUrl(appOrigin, returnQuery),
  });
}

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const checkoutType = String(body?.checkoutType || body?.type || "subscription").toLowerCase();

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    if (!stripePublishableKey()) {
      return jsonWithCors(
        req,
        {
          error:
            "Embedded checkout needs STRIPE_PUBLISHABLE_KEY (pk_test_… or pk_live_…) in Supabase Edge Function secrets.",
        },
        503
      );
    }

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
      const packSecret = `STRIPE_CREDIT_PACK_${packId.toUpperCase()}_PRICE_ID`;
      const priceId = assertCheckoutPriceId(resolveCreditPackPriceId(packId), packSecret);
      if (!priceId) {
        return jsonWithCors(
          req,
          { error: `Stripe price not configured for pack ${packId}. Set ${packSecret} to a price_… ID.` },
          503
        );
      }

      const params = new URLSearchParams({
        mode: "payment",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "metadata[user_id]": uid,
        "metadata[checkout_type]": "credit_pack",
        "metadata[credit_pack_id]": packId,
      });
      for (const [k, v] of embeddedSessionFields(appOrigin, { purchase: "credits", pack: packId })) {
        params.set(k, v);
      }

      const session = await stripeRequest("/checkout/sessions", params);
      const clientSecret = String(session.client_secret || "");
      if (!clientSecret) {
        throw new Error("Stripe did not return a checkout client secret for embedded mode.");
      }

      return jsonWithCors(req, {
        ok: true,
        clientSecret,
        sessionId: session.id,
        packId,
        checkoutType: "credit_pack",
      });
    }

    const planId = normalizePaidPlanId(body?.plan || body?.tier || "creator");
    const interval = normalizeBillingInterval(body?.interval || body?.billingInterval);

    if (!planId) {
      return jsonWithCors(req, { error: "plan must be creator, pro, or studio" }, 400);
    }

    const planSecret = `STRIPE_${planId.toUpperCase()}_${interval === "year" ? "YEARLY" : "MONTHLY"}_PRICE_ID`;
    const priceId = assertCheckoutPriceId(resolveStripePriceId(planId, interval), planSecret);
    if (!priceId) {
      return jsonWithCors(req, { error: `Stripe price not configured for ${planId} (${interval}). Set ${planSecret} to a price_… ID.` }, 503);
    }

    const params = new URLSearchParams({
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[user_id]": uid,
      "metadata[checkout_type]": "subscription",
      "metadata[plan]": planId,
      "metadata[interval]": interval,
      "subscription_data[metadata][user_id]": uid,
      "subscription_data[metadata][plan]": planId,
    });
    for (const [k, v] of embeddedSessionFields(appOrigin, { plan: planId, interval })) {
      params.set(k, v);
    }

    const session = await stripeRequest("/checkout/sessions", params);
    const clientSecret = String(session.client_secret || "");
    if (!clientSecret) {
      throw new Error("Stripe did not return a checkout client secret for embedded mode.");
    }

    return jsonWithCors(req, { ok: true, clientSecret, sessionId: session.id, plan: planId, interval });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

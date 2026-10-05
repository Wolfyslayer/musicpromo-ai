import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { ensureUserBilling } from "../_shared/billing.ts";
import { isBillingExempt, resolveAppRole } from "../_shared/appRoles.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function stripeRequest(path: string, body: URLSearchParams) {
  const secret = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!secret) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  }
  return data;
}

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const priceId = (Deno.env.get("STRIPE_PRO_PRICE_ID") || "").trim();
    if (!priceId) {
      return jsonWithCors(req, { error: "Pro plan is not configured (STRIPE_PRO_PRICE_ID)." }, 503);
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

    const { data: billing } = await admin.from("user_billing").select("stripe_customer_id").eq("user_id", uid).maybeSingle();

    let customerId = billing?.stripe_customer_id || "";
    if (!customerId) {
      const customer = await stripeRequest(
        "/customers",
        new URLSearchParams({
          email: String(user.email || ""),
          "metadata[user_id]": uid,
        })
      );
      customerId = customer.id;
      await admin.from("user_billing").update({ stripe_customer_id: customerId }).eq("user_id", uid);
    }

    const session = await stripeRequest(
      "/checkout/sessions",
      new URLSearchParams({
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appOrigin}/settings/billing?checkout=success`,
        cancel_url: `${appOrigin}/settings/billing?checkout=cancel`,
        "metadata[user_id]": uid,
        "subscription_data[metadata][user_id]": uid,
      })
    );

    return jsonWithCors(req, { ok: true, url: session.url, sessionId: session.id });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

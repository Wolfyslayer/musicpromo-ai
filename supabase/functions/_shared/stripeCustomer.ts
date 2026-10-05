import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Checkout line_items require a Price id (`price_…`), not a Product id (`prod_…`). */
export function assertCheckoutPriceId(raw: string, secretName: string): string {
  const id = String(raw || "").trim();
  if (!id) return id;
  if (id.startsWith("prod_")) {
    throw new Error(
      `${secretName} must be a Stripe Price ID (starts with price_), not a Product ID (${id}). In the Dashboard, open the product → select the $ row → copy Price ID.`
    );
  }
  return id;
}

export async function stripeRequest(path: string, body: URLSearchParams) {
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

export async function ensureStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<string> {
  const { data: billing } = await admin
    .from("user_billing")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = billing?.stripe_customer_id || "";
  if (customerId) return customerId;

  const customer = await stripeRequest(
    "/customers",
    new URLSearchParams({
      email: String(email || ""),
      "metadata[user_id]": userId,
    })
  );
  customerId = customer.id;
  await admin.from("user_billing").update({ stripe_customer_id: customerId }).eq("user_id", userId);
  return customerId;
}

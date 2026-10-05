import { db } from "@/api/base44Client";

export async function fetchBillingStatus() {
  const res = await db.functions.invoke("getUserBilling", { action: "status" });
  return res.data;
}

export async function claimDailyCredits() {
  const res = await db.functions.invoke("getUserBilling", { action: "claim" });
  return res.data;
}

function resolvePublishableKey(apiKey) {
  const fromApi = apiKey && String(apiKey).trim();
  if (fromApi) return fromApi;
  const fromEnv = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return fromEnv && String(fromEnv).trim() ? String(fromEnv).trim() : "";
}

async function invokeCheckout(payload) {
  const res = await db.functions.invoke("createSubscriptionCheckout", payload);
  if (res.data?.billingExempt) {
    return { billingExempt: true, message: res.data.message };
  }
  if (res.data?.error) throw new Error(res.data.error);
  const clientSecret = res.data?.clientSecret;
  if (!clientSecret) throw new Error(res.data?.error || "Could not start checkout.");
  return {
    billingExempt: false,
    clientSecret,
    sessionId: res.data.sessionId,
    checkoutType: res.data.checkoutType,
    packId: res.data.packId,
    plan: res.data.plan,
    interval: res.data.interval,
  };
}

/** Opens embedded checkout in-app; pass result to StripeEmbeddedCheckoutDialog. */
export async function startSubscriptionCheckout(plan = "creator", interval = "month") {
  return invokeCheckout({ plan, interval });
}

export async function startCreditPackCheckout(packId) {
  return invokeCheckout({ checkoutType: "credit_pack", packId });
}

export { resolvePublishableKey };

/** Human-readable labels for credit cost keys returned by the API. */
/** @deprecated use startSubscriptionCheckout */
export async function startProCheckout() {
  return startSubscriptionCheckout("pro", "month");
}

export const CREDIT_ACTION_LABELS = {
  analyze_song: "Song analysis",
  generate_campaign: "Full campaign plan",
  generate_content: "Hooks, captions, hashtags, etc.",
  cover_art: "AI album cover",
  cover_art_edit: "AI cover edit (with reference image)",
  ai_video_clip: "Cloud AI motion clip",
  suno_generation: "AI song (Suno)",
  stem_split: "Stem splitter",
};

export const PLAN_LABELS = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
};

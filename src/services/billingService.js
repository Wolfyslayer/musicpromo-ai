import { db } from "@/api/base44Client";

export async function fetchBillingStatus() {
  const res = await db.functions.invoke("getUserBilling", { action: "status" });
  return res.data;
}

export async function claimDailyCredits() {
  const res = await db.functions.invoke("getUserBilling", { action: "claim" });
  return res.data;
}

export async function startSubscriptionCheckout(plan = "creator", interval = "month") {
  const res = await db.functions.invoke("createSubscriptionCheckout", { plan, interval });
  if (res.data?.billingExempt) {
    return { billingExempt: true, message: res.data.message };
  }
  const url = res.data?.url;
  if (!url) throw new Error(res.data?.error || "Could not start checkout.");
  window.location.assign(url);
  return { billingExempt: false };
}

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

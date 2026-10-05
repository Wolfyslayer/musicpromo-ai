import { db } from "@/api/base44Client";

export async function fetchBillingStatus() {
  const res = await db.functions.invoke("getUserBilling", { action: "status" });
  return res.data;
}

export async function startProCheckout() {
  const res = await db.functions.invoke("createSubscriptionCheckout", {});
  if (res.data?.billingExempt) {
    return { billingExempt: true, message: res.data.message };
  }
  const url = res.data?.url;
  if (!url) throw new Error(res.data?.error || "Could not start checkout.");
  window.location.assign(url);
  return { billingExempt: false };
}

/** Human-readable labels for credit cost keys returned by the API. */
export const CREDIT_ACTION_LABELS = {
  analyze_song: "Song analysis",
  generate_campaign: "Full campaign plan",
  generate_content: "Hooks, captions, hashtags, etc.",
  cover_art: "AI album cover",
  cover_art_edit: "AI cover edit (with reference image)",
  ai_video_clip: "Cloud AI motion clip",
};

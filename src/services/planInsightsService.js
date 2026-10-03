import { db } from "@/api/base44Client";

function unwrap(res) {
  return res?.data ?? res;
}

export async function loadCampaignPlanInsights(campaignId) {
  const res = await db.functions.invoke("getCampaignPlanInsights", { campaignId });
  const body = unwrap(res);
  if (body?.error && !body?.ok) throw new Error(body.error || "Could not load plan insights.");
  return {
    summary: body.summary || null,
    suggestions: body.suggestions || [],
  };
}

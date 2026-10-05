import type { Base44Client } from "npm:@base44/sdk@0.8.52";

const QUEUED_POST_STATUSES = new Set(["scheduled", "publishing"]);

export type CancelCampaignAutoPublishResult = {
  ok: true;
  cancelledPosts: number;
  updatedDays: number;
};

async function cancelSocialPost(
  base44: Base44Client,
  post: Record<string, unknown>,
  message: string
) {
  await base44.asServiceRole.entities.SocialPost.update(String(post.id), {
    status: "draft",
    scheduled_at: "",
    error_code: "CAMPAIGN_CANCELLED",
    error_message: message,
  });
}

/**
 * Stop queued auto-publish for a campaign (scheduled SocialPosts + scheduled/processing days).
 */
export async function cancelCampaignAutoPublishCore(
  base44: Base44Client,
  userId: string,
  campaignId: string
): Promise<CancelCampaignAutoPublishResult> {
  const message = "Auto-publish cancelled because the campaign was removed.";

  const days =
    (await base44.asServiceRole.entities.CampaignDay.filter(
      { campaign_id: campaignId },
      "day_number",
      200
    )) || [];

  let updatedDays = 0;
  for (const day of days) {
    const st = String(day.status || "");
    if (st === "scheduled") {
      await base44.asServiceRole.entities.CampaignDay.update(String(day.id), {
        status: "skipped",
        publish_error: "",
        scheduled_at: "",
      });
      updatedDays += 1;
    } else if (st === "processing") {
      await base44.asServiceRole.entities.CampaignDay.update(String(day.id), {
        status: "failed",
        publish_error: "Campaign removed while publish was in progress.",
        scheduled_at: "",
      });
      updatedDays += 1;
    }
  }

  const cancelledPostIds = new Set<string>();
  let cancelledPosts = 0;

  const byCampaign =
    (await base44.asServiceRole.entities.SocialPost.filter(
      { campaign_id: campaignId, user_id: userId },
      "-created_date",
      500
    )) || [];

  for (const post of byCampaign) {
    if (!QUEUED_POST_STATUSES.has(String(post.status))) continue;
    await cancelSocialPost(base44, post, message);
    cancelledPostIds.add(String(post.id));
    cancelledPosts += 1;
  }

  for (const day of days) {
    const dayPosts =
      (await base44.asServiceRole.entities.SocialPost.filter(
        { campaign_day_id: String(day.id), user_id: userId },
        "-created_date",
        30
      )) || [];
    for (const post of dayPosts) {
      const id = String(post.id);
      if (cancelledPostIds.has(id)) continue;
      if (!QUEUED_POST_STATUSES.has(String(post.status))) continue;
      await cancelSocialPost(base44, post, message);
      cancelledPostIds.add(id);
      cancelledPosts += 1;
    }
  }

  return { ok: true, cancelledPosts, updatedDays };
}

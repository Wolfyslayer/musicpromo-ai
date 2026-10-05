import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";
import { cancelCampaignAutoPublishCore } from "../_shared/campaignCancelAutoPublishCore.ts";

/**
 * Cancel queued auto-publish for a campaign (SocialPosts + scheduled plan days).
 * Body: { campaignId: string }
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId ? String(body.campaignId) : "";
    if (!campaignId) {
      return Response.json({ error: "campaignId is required." }, { status: 400 });
    }

    let campaign: Record<string, unknown> | null = null;
    try {
      campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
    } catch {
      campaign = null;
    }
    if (!campaign) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (!recordOwnedByUser(campaign, user)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await cancelCampaignAutoPublishCore(base44, String(user.id), campaignId);
    return Response.json(result);
  } catch (error) {
    console.error("[campaignCancelAutoPublish]", (error as Error)?.message || error);
    return Response.json({ error: "Could not cancel auto-publish." }, { status: 500 });
  }
}

serveWithCors(handler);

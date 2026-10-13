import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import {
  purgeCampaignStorage,
  purgeOrphanPromoAssetsForUser,
} from "../_shared/promoStorageCleanup.ts";

/**
 * Removes music-promo-assets objects for a deleted campaign (if unreferenced elsewhere),
 * or all orphan files for the signed-in user when { orphanOnly: true }.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const admin = serviceClient();
    const userId = String(user.id);

    if (body?.orphanOnly === true) {
      const result = await purgeOrphanPromoAssetsForUser(admin, userId);
      return Response.json({ ok: true, mode: "orphan", ...result });
    }

    const campaignId = body?.campaignId ? String(body.campaignId) : "";
    if (!campaignId) {
      return Response.json({ error: "campaignId is required." }, { status: 400 });
    }

    const campaign = await admin
      .from("campaign_days")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "campaign")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign.data?.id) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }

    const result = await purgeCampaignStorage(admin, userId, campaignId);
    return Response.json({ ok: true, mode: "campaign", campaignId, ...result });
  } catch (error) {
    console.error("[purgeCampaignStorage]", (error as Error)?.message || error);
    return Response.json({ error: "Storage cleanup failed." }, { status: 500 });
  }
}

serveWithCors(handler);

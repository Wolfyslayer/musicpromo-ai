import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, secrets, serviceClient } from "../_shared/runtime.ts";
import {
  collectCampaignStoragePaths,
  collectReferencedStoragePaths,
  purgeCampaignStorage,
  purgeOrphanPromoAssetsForUser,
} from "../_shared/promoStorageCleanup.ts";

/**
 * Removes music-promo-assets objects for a deleted campaign (if unreferenced elsewhere),
 * or orphan files for a user when { orphanOnly: true }.
 *
 * Auth: signed-in user JWT, or GitHub/cron via header x-promo-storage-secret + body.userId
 * (must match Supabase secret PROMO_STORAGE_CRON_SECRET).
 */
async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = serviceClient();
    const cronSecret = secrets.get("PROMO_STORAGE_CRON_SECRET") || "";
    const headerSecret = req.headers.get("x-promo-storage-secret") || "";
    const dryRun = body?.dryRun === true || body?.dry_run === true;

    let userId = "";
    if (cronSecret && headerSecret && headerSecret === cronSecret) {
      userId = String(body.userId || body.user_id || "").trim();
      if (!userId) {
        return Response.json({ error: "userId is required when using x-promo-storage-secret." }, { status: 400 });
      }
    } else {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = String(user.id);
    }

    if (body?.orphanOnly === true) {
      const result = await purgeOrphanPromoAssetsForUser(admin, userId, { dryRun });
      return Response.json({ ok: true, mode: "orphan", userId, ...result });
    }

    const campaignId = body?.campaignId ? String(body.campaignId) : "";
    if (!campaignId) {
      return Response.json(
        { error: "Send { orphanOnly: true } or { campaignId: \"...\" }." },
        { status: 400 }
      );
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

    if (dryRun) {
      const campaignPaths = await collectCampaignStoragePaths(admin, userId, campaignId);
      const stillUsed = await collectReferencedStoragePaths(admin, userId, { excludeCampaignId: campaignId });
      const paths = [...campaignPaths].filter((p) => !stillUsed.has(p));
      return Response.json({
        ok: true,
        mode: "campaign",
        dryRun: true,
        campaignId,
        userId,
        paths,
        deleted: 0,
        errors: [],
      });
    }

    const result = await purgeCampaignStorage(admin, userId, campaignId);
    return Response.json({ ok: true, mode: "campaign", campaignId, userId, ...result });
  } catch (error) {
    console.error("[purgeCampaignStorage]", (error as Error)?.message || error);
    return Response.json({ error: "Storage cleanup failed." }, { status: 500 });
  }
}

serveWithCors(handler);

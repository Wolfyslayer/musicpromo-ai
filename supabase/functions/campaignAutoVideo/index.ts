import { createClientFromRequest } from "../_shared/runtime.ts";
import { attachClientRenderedVideo } from "../_shared/videoRender.ts";
import { recordOwnedByUser } from "../_shared/ownership.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

/**
 * Attach a client-rendered 9:16 promo MP4 to a campaign.
 * Body: { campaignId: string, videoUrl: string }
 *
 * Server-side encode is disabled — the browser uploads the Remotion MP4 first.
 */
async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return jsonWithCors(req, { error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId ? String(body.campaignId) : "";
    const videoUrl = body?.videoUrl ? String(body.videoUrl).trim() : "";

    if (!campaignId) {
      return jsonWithCors(req, { error: "campaignId is required." }, 400);
    }
    if (!videoUrl) {
      return jsonWithCors(
        req,
        {
          ok: false,
          error:
            "videoUrl is required. Render the promo video in the browser and upload the MP4 before calling this endpoint.",
          code: "CLIENT_RENDER_REQUIRED",
        },
        400
      );
    }

    const campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
    if (!campaign) {
      return jsonWithCors(req, { error: "Campaign not found." }, 404);
    }
    if (!recordOwnedByUser(campaign, user)) {
      return jsonWithCors(req, { error: "Forbidden" }, 403);
    }

    const attached = await attachClientRenderedVideo({
      base44,
      campaignId,
      userId: user.id,
      videoUrl,
    });

    if (!attached.ok) {
      return jsonWithCors(
        req,
        {
          ok: false,
          error: attached.errors[0] || "Could not save pre-rendered video.",
          code: attached.errors[0] || "ATTACH_FAILED",
          details: attached,
        },
        400
      );
    }

    return jsonWithCors(req, {
      ok: true,
      attached,
      preparedMediaId: attached.preparedMediaId,
      videoUrl: attached.videoUrl,
      note: "Client-rendered MP4 saved to PreparedMedia and linked to campaign days.",
    });
  } catch (error) {
    console.error("[campaignAutoVideo]", (error as Error)?.message || error);
    return jsonWithCors(req, { error: "Could not save client-rendered video." }, 500);
  }
}

servePostApi(handler);

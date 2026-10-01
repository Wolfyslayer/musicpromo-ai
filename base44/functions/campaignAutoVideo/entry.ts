import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { attachClientRenderedVideo } from "../../shared/videoRender.ts";
import { recordOwnedByUser } from "../../shared/ownership.ts";

/**
 * Attach a client-rendered 9:16 promo MP4 to a campaign.
 * Body: { campaignId: string, videoUrl: string }
 *
 * Server-side encode is disabled — the browser uploads the Remotion MP4 first.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body?.campaignId ? String(body.campaignId) : "";
    const videoUrl = body?.videoUrl ? String(body.videoUrl).trim() : "";

    if (!campaignId) {
      return Response.json({ error: "campaignId is required." }, { status: 400 });
    }
    if (!videoUrl) {
      return Response.json(
        {
          ok: false,
          error:
            "videoUrl is required. Render the promo video in the browser and upload the MP4 before calling this endpoint.",
          code: "CLIENT_RENDER_REQUIRED",
        },
        { status: 400 }
      );
    }

    const campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
    if (!campaign) {
      return Response.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (!recordOwnedByUser(campaign, user)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const attached = await attachClientRenderedVideo({
      base44,
      campaignId,
      userId: user.id,
      videoUrl,
    });

    if (!attached.ok) {
      return Response.json(
        {
          ok: false,
          error: attached.errors[0] || "Could not save pre-rendered video.",
          code: attached.errors[0] || "ATTACH_FAILED",
          details: attached,
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      attached,
      preparedMediaId: attached.preparedMediaId,
      videoUrl: attached.videoUrl,
      note: "Client-rendered MP4 saved to PreparedMedia and linked to campaign days.",
    });
  } catch (error) {
    console.error("[campaignAutoVideo]", (error as Error)?.message || error);
    return Response.json({ error: "Could not save client-rendered video." }, { status: 500 });
  }
}

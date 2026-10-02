import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import {
  MEDIA_REQUIREMENTS,
  MediaPreparationError,
  prepareInstagramFeedImage,
  type PreparationPurpose,
} from "../_shared/mediaPreparation.ts";

function safePrepared(result: {
  id: string;
  sourceUrl: string;
  sourceFormat: string;
  preparedUrl: string;
  preparedFormat: string;
  purpose: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  status: string;
  reused: boolean;
}) {
  return {
    id: result.id,
    sourceUrl: result.sourceUrl,
    sourceFormat: result.sourceFormat,
    preparedUrl: result.preparedUrl,
    preparedFormat: result.preparedFormat,
    purpose: result.purpose,
    width: result.width,
    height: result.height,
    fileSize: result.fileSize,
    status: result.status,
    reused: result.reused,
  };
}

/**
 * Prepare media for social publishing (image → public HTTPS JPEG for Instagram).
 * Does not call Meta. Does not touch OAuth tokens.
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sourceUrl = String(body?.sourceUrl || body?.mediaUrl || "").trim();
    const purpose = String(body?.purpose || "instagram_feed_image") as PreparationPurpose;

    if (!sourceUrl) {
      return Response.json(
        { error: "sourceUrl is required.", code: "MEDIA_SOURCE_MISSING" },
        { status: 400 }
      );
    }

    const requirement = MEDIA_REQUIREMENTS[purpose];
    if (!requirement) {
      return Response.json(
        { error: "Unknown preparation purpose.", code: "MEDIA_PURPOSE_UNSUPPORTED" },
        { status: 400 }
      );
    }
    if (!requirement.implemented) {
      return Response.json(
        {
          error: "Video media preparation is not available yet.",
          code: "MEDIA_PURPOSE_UNSUPPORTED",
        },
        { status: 400 }
      );
    }

    const result = await prepareInstagramFeedImage({
      base44,
      userId: user.id,
      sourceUrl,
      purpose,
    });

    return Response.json({
      ok: true,
      prepared: safePrepared(result),
    });
  } catch (error) {
    if (error instanceof MediaPreparationError) {
      console.error("[prepareMedia]", error.code, error.message);
      return Response.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("[prepareMedia]", (error as { message?: string })?.message || "preparation failed");
    return Response.json(
      { error: "Media preparation failed.", code: "MEDIA_PREPARATION_FAILED" },
      { status: 500 }
    );
  }
}


serveWithCors(handler);

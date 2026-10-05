import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import {
  coverArtProviderStatus,
  generateCloudCoverArt,
  persistCoverArtToStorage,
} from "../_shared/aiCoverArt.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "status") {
      return jsonWithCors(req, coverArtProviderStatus());
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const prompt = String(body?.prompt || body?.description || "").trim();
    const title = String(body?.title || body?.albumTitle || "").trim();
    const artistName = String(body?.artistName || body?.artist || "").trim();
    const genre = String(body?.genre || "").trim();
    const mood = String(body?.mood || "").trim();
    const useLlmPrompt = body?.useLlmPrompt !== false;

    const generated = await generateCloudCoverArt({
      prompt,
      title,
      artistName,
      genre,
      mood,
      useLlmPrompt,
    });

    const publicUrl = await persistCoverArtToStorage(serviceClient(), user.id, generated.sourceUrl);

    return jsonWithCors(req, {
      ok: true,
      imageUrl: publicUrl,
      sourceUrl: generated.sourceUrl,
      provider: generated.provider,
      imagePrompt: generated.imagePrompt,
      billingNote: generated.billingNote,
    });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

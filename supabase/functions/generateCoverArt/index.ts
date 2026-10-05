import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import {
  coverArtProviderStatus,
  generateCloudCoverArt,
  persistCoverArtFromBytes,
  persistCoverArtToStorage,
} from "../_shared/aiCoverArt.ts";
import { billingErrorResponse, spendCredits } from "../_shared/billing.ts";

function decodeReferenceImageBase64(raw: unknown): Uint8Array | undefined {
  const b64 = String(raw || "").trim();
  if (!b64) return undefined;
  const cleaned = b64.includes(",") ? b64.split(",").pop()! : b64;
  const binary = atob(cleaned.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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

    const referenceImageBytes = decodeReferenceImageBase64(body?.referenceImageBase64);

    const admin = serviceClient();
    let creditsRemaining: number | undefined;
    try {
      const spend = await spendCredits(
        admin,
        String(user.id),
        referenceImageBytes?.byteLength ? "cover_art_edit" : "cover_art"
      );
      creditsRemaining = spend.balanceAfter;
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }

    const generated = await generateCloudCoverArt({
      prompt,
      title,
      artistName,
      genre,
      mood,
      useLlmPrompt,
      referenceImageBytes,
    });

    const publicUrl = generated.imageBytes?.byteLength
      ? await persistCoverArtFromBytes(admin, user.id, generated.imageBytes)
      : generated.sourceUrl
        ? await persistCoverArtToStorage(admin, user.id, generated.sourceUrl)
        : "";

    if (!publicUrl) throw new Error("Could not save generated cover.");

    return jsonWithCors(req, {
      ok: true,
      imageUrl: publicUrl,
      sourceUrl: generated.sourceUrl || publicUrl,
      provider: generated.provider,
      imagePrompt: generated.imagePrompt,
      billingNote: generated.billingNote,
      mode: generated.mode,
      creditsRemaining,
    });
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

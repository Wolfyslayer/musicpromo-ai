import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { generateReplicateImageToVideo, persistAiClipToStorage } from "../_shared/replicateVideo.ts";

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const imageUrl = String(body?.imageUrl || body?.artworkUrl || "").trim();
    const prompt = String(body?.prompt || body?.videoConcept || "").trim();
    const projectId = String(body?.projectId || "").trim();

    if (!imageUrl) {
      return jsonWithCors(req, { error: "imageUrl is required." }, 400);
    }

    const { replicateUrl, predictionId } = await generateReplicateImageToVideo({ imageUrl, prompt });
    const publicUrl = await persistAiClipToStorage(serviceClient(), user.id, replicateUrl);

    if (projectId) {
      try {
        const project = await base44.asServiceRole.entities.VideoProject.get(projectId);
        if (project) {
          await base44.asServiceRole.entities.VideoProject.update(projectId, {
            ai_clip_url: publicUrl,
            ai_clip_status: "ready",
            ai_clip_prompt: prompt,
            compositing_mode: project.compositing_mode || "ai_blend",
          });
        }
      } catch {
        /* optional link */
      }
    }

    return jsonWithCors(req, {
      ok: true,
      videoUrl: publicUrl,
      replicateUrl,
      predictionId,
      billingNote: "Billed by Replicate to your API token (~$0.02–0.08 per clip for SVD-class models).",
    });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

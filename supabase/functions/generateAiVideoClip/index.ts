import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import {
  aiVideoProviderStatus,
  generateCloudImageToVideo,
  persistAiClipToStorage,
} from "../_shared/aiVideoClip.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "status") {
      return jsonWithCors(req, aiVideoProviderStatus());
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const imageUrl = String(body?.imageUrl || body?.artworkUrl || "").trim();
    const prompt = String(body?.prompt || body?.videoConcept || "").trim();
    const projectId = String(body?.projectId || "").trim();
    const songTitle = String(body?.songTitle || "").trim();
    const useLlmPrompt = body?.useLlmPrompt !== false;

    if (!imageUrl) {
      return jsonWithCors(req, { error: "imageUrl is required." }, 400);
    }

    const generated = await generateCloudImageToVideo({
      imageUrl,
      prompt,
      songTitle,
      useLlmPrompt,
    });
    const publicUrl = await persistAiClipToStorage(serviceClient(), user.id, generated.sourceUrl);

    if (projectId) {
      try {
        const project = await base44.asServiceRole.entities.VideoProject.get(projectId);
        if (project) {
          await base44.asServiceRole.entities.VideoProject.update(projectId, {
            ai_clip_url: publicUrl,
            ai_clip_status: "ready",
            ai_clip_prompt: generated.motionPrompt,
            compositing_mode: project.compositing_mode || "ai_blend",
          });
        }
      } catch {
        /* optional */
      }
    }

    return jsonWithCors(req, {
      ok: true,
      videoUrl: publicUrl,
      sourceUrl: generated.sourceUrl,
      provider: generated.provider,
      motionPrompt: generated.motionPrompt,
      billingNote: generated.billingNote,
      groqNote: aiVideoProviderStatus().groqPromptAssist
        ? "Motion prompt was refined with your Groq/OpenAI text API (Groq does not render video)."
        : "Set OPENAI_BASE_URL to Groq for free motion prompt wording; video pixels still use fal/Replicate.",
    });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { billingErrorResponse, refundCredits, spendCredits } from "../_shared/billing.ts";
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

    const admin = serviceClient();
    const uid = String(user.id);
    let spendResult: { cost: number; balanceAfter: number };
    try {
      spendResult = await spendCredits(admin, uid, "ai_video_clip", { projectId });
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }

    let generated;
    try {
      generated = await generateCloudImageToVideo({
        imageUrl,
        prompt,
        songTitle,
        useLlmPrompt,
      });
    } catch (genErr) {
      if (spendResult.cost > 0) {
        await refundCredits(admin, uid, spendResult.cost, (genErr as Error).message).catch(() => {});
      }
      throw genErr;
    }

    let publicUrl: string;
    try {
      publicUrl = await persistAiClipToStorage(admin, user.id, generated.sourceUrl);
    } catch (persistErr) {
      if (spendResult.cost > 0) {
        await refundCredits(admin, uid, spendResult.cost, (persistErr as Error).message).catch(() => {});
      }
      throw persistErr;
    }

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
      creditsRemaining: spendResult.balanceAfter,
      billingNote: generated.billingNote,
      groqNote: aiVideoProviderStatus().groqPromptAssist
        ? "Motion prompt was refined with Gemini (text only — video pixels still use fal/Replicate if enabled)."
        : "Set GEMINI_API_KEY for free motion prompt wording; video pixels still use fal/Replicate.",
    });
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { billingErrorResponse, withMeteredCreditCharge } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import {
  aiVideoProviderStatus,
  generateCloudImageToVideo,
  persistAiClipToStorage,
  resolveAiVideoProvider,
} from "../_shared/aiVideoClip.ts";
import { creditsForCloudVideoClip, usageBasedCreditsEnabled } from "../_shared/usageCredits.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "status") {
      const status = aiVideoProviderStatus();
      return jsonWithCors(req, {
        ...status,
        usageBasedCredits: usageBasedCreditsEnabled(),
      });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const imageUrl = String(body?.imageUrl || body?.artworkUrl || "").trim();
    const prompt = String(body?.prompt || body?.videoConcept || "").trim();
    const projectId = String(body?.projectId || "").trim();
    const songTitle = String(body?.songTitle || "").trim();
    const useLlmPrompt = body?.useLlmPrompt !== false;
    const durationSec = Number(body?.durationSec || body?.duration || 5);
    const resolution = String(body?.resolution || "720p");

    if (!imageUrl) {
      return jsonWithCors(req, { error: "imageUrl is required." }, 400);
    }

    const videoProvider = resolveAiVideoProvider();
    if (videoProvider === "off") {
      return jsonWithCors(req, { error: aiVideoProviderStatus().note }, 503);
    }

    const admin = serviceClient();
    const uid = String(user.id);

    const runGeneration = async () => {
      const generated = await generateCloudImageToVideo({
        imageUrl,
        prompt,
        songTitle,
        useLlmPrompt,
        durationSec,
        resolution,
      });

      const publicUrl = await persistAiClipToStorage(admin, user.id, generated.sourceUrl);

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

      const sec = generated.durationSec ?? durationSec;
      const creditCost = usageBasedCreditsEnabled()
        ? creditsForCloudVideoClip(generated.provider as "atlas" | "fal" | "replicate", sec, resolution)
        : 0;

      return {
        payload: {
          ok: true,
          videoUrl: publicUrl,
          sourceUrl: generated.sourceUrl,
          provider: generated.provider,
          motionPrompt: generated.motionPrompt,
          billingNote: generated.billingNote,
          durationSec: sec,
          groqNote: aiVideoProviderStatus().groqPromptAssist
            ? "Motion prompt was refined with your configured LLM (text only)."
            : "Set GEMINI_API_KEY or AI_PROVIDER=atlas for motion prompt wording.",
        },
        creditCost,
        usageDetail: { provider: generated.provider, durationSec: sec, resolution },
      };
    };

    try {
      if (usageBasedCreditsEnabled()) {
        const estimate = creditsForCloudVideoClip(
          videoProvider as "atlas" | "fal" | "replicate",
          durationSec,
          resolution
        );
        const { result, spend } = await withMeteredCreditCharge(
          admin,
          uid,
          "ai_video_clip",
          { projectId },
          estimate,
          async () => {
            const out = await runGeneration();
            return { result: out.payload, creditCost: out.creditCost, usageDetail: out.usageDetail };
          }
        );
        return jsonWithCors(req, {
          ...result,
          creditsCharged: spend.cost,
          creditsRemaining: spend.balanceAfter,
        });
      }

      const { payload } = await runGeneration();
      return jsonWithCors(req, {
        ...payload,
        creditsRemaining: null,
      });
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

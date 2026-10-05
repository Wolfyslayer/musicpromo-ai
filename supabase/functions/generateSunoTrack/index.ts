import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { billingErrorResponse, spendCredits } from "../_shared/billing.ts";
import { assertPremiumFeature, premiumErrorResponse } from "../_shared/premiumFeatures.ts";
import { generateSunoTrack, sunoProviderStatus } from "../_shared/sunoGenerate.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "status") {
      return jsonWithCors(req, sunoProviderStatus());
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const admin = serviceClient();
    const uid = String(user.id);

    try {
      await assertPremiumFeature(admin, uid, "suno_generation");
    } catch (e) {
      const prem = premiumErrorResponse(e);
      if (prem) return jsonWithCors(req, prem.body, prem.status);
      throw e;
    }

    const prompt = String(body?.prompt || "").trim();
    if (!prompt) return jsonWithCors(req, { error: "prompt is required" }, 400);

    let creditsRemaining: number | undefined;
    try {
      const spend = await spendCredits(admin, uid, "suno_generation", { prompt: prompt.slice(0, 120) });
      creditsRemaining = spend.balanceAfter;
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }

    const generated = await generateSunoTrack({
      prompt,
      lyrics: String(body?.lyrics || ""),
      title: String(body?.title || ""),
      instrumental: body?.instrumental === true,
    });

    return jsonWithCors(req, {
      ok: true,
      audioUrl: generated.audioUrl,
      taskId: generated.taskId,
      creditsRemaining,
    });
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    const prem = premiumErrorResponse(error);
    if (prem) return jsonWithCors(req, prem.body, prem.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

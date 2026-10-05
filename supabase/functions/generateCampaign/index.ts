import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildGenerateCampaignPrompt } from "../_shared/aiPrompts.ts";
import { billingErrorResponse, withCreditCharge } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { runGeminiCampaignLlm } from "../_shared/runCampaignLlm.ts";

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json();
    if (!body || !body.song || !body.song.title) {
      return jsonWithCors(req, { error: "Song is required" }, 400);
    }
    const durationDays = Number(body.durationDays) || 7;
    if (![7, 14, 30].includes(durationDays)) {
      return jsonWithCors(req, { error: "durationDays must be 7, 14 or 30" }, 400);
    }

    const admin = serviceClient();
    const uid = String(user.id);
    try {
      const { result, spend } = await withCreditCharge(admin, uid, "generate_campaign", {}, async () => {
        const { prompt, schema } = buildGenerateCampaignPrompt({
          song: body.song,
          analysis: body.analysis,
          goals: body.goals,
          durationDays,
          startDate: body.startDate,
          promoStyle: body.promoStyle,
        });
        return runGeminiCampaignLlm({
          body: body.song as Record<string, unknown>,
          prompt,
          schema,
          modelKind: "generate_campaign",
        });
      });
      return jsonWithCors(req, {
        ...(typeof result === "object" ? result : { result }),
        creditsRemaining: spend.balanceAfter,
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

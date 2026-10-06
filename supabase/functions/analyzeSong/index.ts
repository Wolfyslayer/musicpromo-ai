import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildAnalyzeSongPrompt } from "../_shared/aiPrompts.ts";
import { billingErrorResponse } from "../_shared/billing.ts";
import { chargeForLlmJson } from "../_shared/meteredLlmHandlers.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { runGeminiCampaignLlm } from "../_shared/runCampaignLlm.ts";

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json();
    if (!body || !body.title) {
      return jsonWithCors(req, { error: "Song title is required" }, 400);
    }

    const admin = serviceClient();
    const uid = String(user.id);
    try {
      const { prompt, schema } = buildAnalyzeSongPrompt(body);
      const { result, balanceAfter } = await chargeForLlmJson(admin, uid, "analyze_song", prompt, async () =>
        runGeminiCampaignLlm({
          body,
          prompt,
          schema,
          modelKind: "analyze_song",
        }) as Promise<Record<string, unknown>>
      );
      return jsonWithCors(req, {
        ...(typeof result === "object" ? result : { result }),
        creditsRemaining: balanceAfter,
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

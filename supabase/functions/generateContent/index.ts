import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildContentPrompt } from "../_shared/aiPrompts.ts";
import { billingErrorResponse } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";
import { chargeForLlmJson } from "../_shared/meteredLlmHandlers.ts";
import { invokeLlmWithUsage } from "../_shared/invokeLlm.ts";
import { resolveAiProvider } from "../_shared/aiProvider.ts";
import { creditsFromTokenUsage, usageBasedCreditsEnabled } from "../_shared/usageCredits.ts";

async function handler(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const body = await req.json();
    if (!body || !body.song || !body.contentType) {
      return jsonWithCors(req, { error: "song and contentType are required" }, 400);
    }

    const admin = serviceClient();
    const uid = String(user.id);
    try {
      const { prompt, schema } = buildContentPrompt({
        song: body.song,
        analysis: body.analysis,
        platform: body.platform,
        contentType: body.contentType,
        campaignGoals: body.campaignGoals,
      });
      const llmProvider = resolveAiProvider() === "atlas" ? "atlas" : "gemini";
      const { result, balanceAfter } = await chargeForLlmJson(admin, uid, "generate_content", prompt, async () => {
        const { content, usage } = await invokeLlmWithUsage({
          prompt,
          response_json_schema: schema,
          provider: llmProvider,
          modelSlot: "generate_content",
        });
        const base =
          typeof content === "object" && content ? (content as Record<string, unknown>) : { result: content };
        if (!usageBasedCreditsEnabled()) return base;
        return {
          ...base,
          _usageCredits: creditsFromTokenUsage(usage),
          _tokenUsage: usage,
        };
      });
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

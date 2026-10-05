import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildContentPrompt } from "../_shared/aiPrompts.ts";
import { billingErrorResponse, withCreditCharge } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

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
      const { result, spend } = await withCreditCharge(admin, uid, "generate_content", {}, async () => {
        const { prompt, schema } = buildContentPrompt({
          song: body.song,
          analysis: body.analysis,
          platform: body.platform,
          contentType: body.contentType,
          campaignGoals: body.campaignGoals,
        });
        return base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: schema,
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

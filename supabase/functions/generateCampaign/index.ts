import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { buildGenerateCampaignPrompt } from "../_shared/aiPrompts.ts";
import { billingErrorResponse, spendCredits } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

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

    let creditsRemaining: number | undefined;
    try {
      const spend = await spendCredits(serviceClient(), String(user.id), "generate_campaign");
      creditsRemaining = spend.balanceAfter;
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }

    const { prompt, schema } = buildGenerateCampaignPrompt({
      song: body.song,
      analysis: body.analysis,
      goals: body.goals,
      durationDays,
      startDate: body.startDate,
      promoStyle: body.promoStyle,
    });
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });
    return jsonWithCors(req, { ...(typeof result === "object" ? result : { result }), creditsRemaining });
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

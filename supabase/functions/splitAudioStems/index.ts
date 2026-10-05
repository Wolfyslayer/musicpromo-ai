import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { billingErrorResponse, refundCredits, spendCredits } from "../_shared/billing.ts";
import { assertPremiumFeature, premiumErrorResponse } from "../_shared/premiumFeatures.ts";
import { splitAudioToStems, stemSplitProviderStatus } from "../_shared/stemSplit.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "status") {
      return jsonWithCors(req, stemSplitProviderStatus());
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const admin = serviceClient();
    const uid = String(user.id);

    try {
      await assertPremiumFeature(admin, uid, "stem_split");
    } catch (e) {
      const prem = premiumErrorResponse(e);
      if (prem) return jsonWithCors(req, prem.body, prem.status);
      throw e;
    }

    const audioUrl = String(body?.audioUrl || body?.audio_url || "").trim();
    if (!audioUrl) return jsonWithCors(req, { error: "audioUrl is required" }, 400);

    let spendResult: { cost: number; balanceAfter: number };
    try {
      spendResult = await spendCredits(admin, uid, "stem_split", { audioUrl: audioUrl.slice(0, 200) });
    } catch (creditErr) {
      const billed = billingErrorResponse(creditErr);
      if (billed) return jsonWithCors(req, billed.body, billed.status);
      throw creditErr;
    }

    try {
      const result = await splitAudioToStems(audioUrl);
      return jsonWithCors(req, {
        ok: true,
        stems: result.stems,
        provider: result.provider,
        creditsRemaining: spendResult.balanceAfter,
      });
    } catch (err) {
      if (spendResult.cost > 0) {
        await refundCredits(admin, uid, spendResult.cost, (err as Error).message).catch(() => {});
      }
      throw err;
    }
  } catch (error) {
    const billed = billingErrorResponse(error);
    if (billed) return jsonWithCors(req, billed.body, billed.status);
    const prem = premiumErrorResponse(error);
    if (prem) return jsonWithCors(req, prem.body, prem.status);
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { ensureUserBilling, getBillingSnapshot } from "../_shared/billing.ts";
import { DailyClaimError, performDailyClaim } from "../_shared/dailyClaims.ts";
import { isBillingExempt } from "../_shared/appRoles.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const admin = serviceClient();
    const uid = String(user.id);

    if (action === "claim") {
      if (await isBillingExempt(admin, uid)) {
        return jsonWithCors(req, {
          ok: true,
          billingExempt: true,
          message: "Staff accounts do not need daily claims.",
        });
      }
      await ensureUserBilling(admin, uid);
      try {
        const claim = await performDailyClaim(admin, uid);
        const snapshot = await getBillingSnapshot(admin, uid);
        return jsonWithCors(req, { ok: true, ...snapshot, ...claim });
      } catch (err) {
        if (err instanceof DailyClaimError) {
          return jsonWithCors(req, { error: err.message, code: err.code }, err.status);
        }
        throw err;
      }
    }

    if (action !== "status") {
      return jsonWithCors(req, { error: "Use action: status or claim" }, 400);
    }

    const snapshot = await getBillingSnapshot(admin, uid);
    return jsonWithCors(req, { ok: true, ...snapshot });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);

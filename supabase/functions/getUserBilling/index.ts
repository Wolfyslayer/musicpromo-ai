import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import { getBillingSnapshot } from "../_shared/billing.ts";
import { jsonWithCors, servePostApi } from "../_shared/cors.ts";

async function handler(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "status") {
      return jsonWithCors(req, { error: "Use action: status" }, 400);
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonWithCors(req, { error: "Unauthorized" }, 401);

    const snapshot = await getBillingSnapshot(serviceClient(), String(user.id));
    return jsonWithCors(req, { ok: true, ...snapshot });
  } catch (error) {
    return jsonWithCors(req, { error: (error as Error).message }, 500);
  }
}

servePostApi(handler);
